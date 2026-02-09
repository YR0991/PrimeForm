/**
 * Daily advice and check-in routes.
 * - POST /api/daily-advice: full PrimeForm logic, overrides (Lethargy, Elite, Sick), Menstruatie Reset, Firestore dailyLogs.
 * - POST /api/save-checkin: validate + red flags + recommendation, save to daily_logs (root collection).
 * - POST /api/check-luteal-phase: cycle phase calculation only.
 */

const express = require('express');
const cycleService = require('../services/cycleService');

/**
 * @param {object} deps - { db, admin, openai, knowledgeBaseContent, FieldValue }
 * @returns {express.Router}
 */
function createDailyRouter(deps) {
  const { db, admin, openai, knowledgeBaseContent, FieldValue } = deps;

  async function getDetectedWorkoutForAI(userId) {
    if (!db || !userId) return '';
    try {
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const snap = await db.collection('users').doc(String(userId)).collection('activities').get();
      const activities = [];
      snap.docs.forEach((doc) => {
        const d = doc.data() || {};
        const dateLocal = (d.start_date_local || d.start_date || '').toString().slice(0, 10);
        if (dateLocal === today || dateLocal === yesterday) activities.push({ ...d, id: doc.id });
      });
      if (activities.length === 0) return '';
      activities.sort((a, b) => (b.start_date_local || b.start_date || '').localeCompare(a.start_date_local || a.start_date || ''));
      const a = activities[0];
      const typeMap = { Run: 'Hardlopen', Ride: 'Fietsen', VirtualRide: 'Virtueel fietsen', Swim: 'Zwemmen' };
      const typeLabel = typeMap[a.type] || a.type || 'Workout';
      const durationMin = a.moving_time ? Math.round(a.moving_time / 60) : null;
      const avgHr = a.average_heartrate != null ? a.average_heartrate : null;
      const ss = a.suffer_score != null ? Number(a.suffer_score) : null;
      let load = 'Unknown';
      if (ss != null) { if (ss <= 50) load = 'Low'; else if (ss <= 100) load = 'Medium'; else load = 'High'; }
      const parts = [`Type: ${typeLabel}`];
      if (durationMin) parts.push(`Duration: ${durationMin}min`);
      if (avgHr) parts.push(`Avg HR: ${avgHr}`);
      parts.push(`Load: ${load}`);
      return `[DETECTED WORKOUT]: ${parts.join(', ')}.`;
    } catch (e) {
      console.error('getDetectedWorkoutForAI:', e);
      return '';
    }
  }

  async function generateAICoachingMessage(status, phaseName, metrics, redFlags, profileContext, detectedWorkout, flags) {
    try {
      const complianceInstruction = detectedWorkout
        ? '\n\nCOMPLIANCE CHECK: Check if the detected workout matches the advice given yesterday. If I advised Recover or Rest but the user did a High Load workout, mention it gently in your advice (e.g. "Ik zie dat je flink bent gegaan – volgende keer even afstemmen op het advies."). Do not be harsh.'
        : '';
      const sicknessInstruction = flags.isSickOrInjured
        ? '\n\nACUTE HEALTH STATE: The user reported being sick or injured today. You MUST prescribe a Rust & Herstel / very light active recovery plan, regardless of how strong the biometrics look. Protect the athlete from overreaching.'
        : '';
      const systemPrompt = `Je bent PrimeForm, de elite biohacking coach. Gebruik ONDERSTAANDE kennisbasis strikt voor je advies. Wijk hier niet van af.

--- KNOWLEDGE BASE START ---
${knowledgeBaseContent}
--- KNOWLEDGE BASE END ---

INSTRUCTION FOR LANGUAGE GENERATION: 1. REASONING: First, think in English about the advice based on Logic v2.0. 2. TRANSLATION: When writing the final response in Dutch, imagine you are texting a smart friend. Use short sentences. Use 'spreektaal' (spoken language), not 'schrijftaal' (written language). 3. FILTER: Check against lingo.md restrictions. If it sounds like a translated document, REWRITE it to sound human.${complianceInstruction}${sicknessInstruction}

IntakeData (kan leeg zijn):
${profileContext ? JSON.stringify(profileContext).slice(0, 2500) : 'null'}`;

      const hrvRefBaseline = metrics.hrv.adjustedBaseline || metrics.hrv.baseline;
      const hrvChange = ((metrics.hrv.current - hrvRefBaseline) / hrvRefBaseline * 100).toFixed(1);
      const hrvTrend = metrics.hrv.current > hrvRefBaseline ? 'verhoogd' : metrics.hrv.current < hrvRefBaseline ? 'verlaagd' : 'stabiel';
      const workoutLine = detectedWorkout ? `\n${detectedWorkout}\n` : '';
      const userPrompt = `Status: ${status}
Cyclusfase: ${phaseName}
Readiness: ${metrics.readiness}/10
Slaap: ${metrics.sleep} uur
RHR: ${metrics.rhr.current} bpm (baseline: ${metrics.rhr.baseline} bpm${metrics.rhr.lutealCorrection ? ', Luteale correctie toegepast' : ''})
HRV: ${metrics.hrv.current} (baseline: ${metrics.hrv.baseline}${metrics.hrv.adjustedBaseline ? `, adjusted: ${Number(metrics.hrv.adjustedBaseline).toFixed(1)}${metrics.hrv.lutealOffsetApplied ? ' (Luteal offset +12%)' : ''}` : ''}, ${hrvTrend} met ${Math.abs(hrvChange)}%)
Red Flags: ${redFlags.count} (${redFlags.reasons.join(', ') || 'geen'})${workoutLine}

Schrijf een korte coach-notitie met de gevraagde H3-structuur.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 350,
        temperature: 0.7
      });
      return completion.choices[0].message.content.trim();
    } catch (error) {
      console.error('Error generating AI message:', error);
      return `### Status\n${status} (fase: ${phaseName}).\n\n### Tactisch Advies\n- Houd het plan aan, maar schaal op hersteldata.\n- Monitor HRV/RHR trend en respecteer red flags.\n\n### Fueling Tip\n- Ochtend: eiwit + hydratatie vroeg.\n- Avond: eiwit + koolhydraten richting slaap.`;
    }
  }

  const router = express.Router();

  // POST /api/check-luteal-phase
  router.post('/check-luteal-phase', (req, res) => {
    try {
      const { lastPeriodDate, cycleLength } = req.body;
      if (!lastPeriodDate) {
        return res.status(400).json({ error: 'lastPeriodDate is required. Please provide a date in YYYY-MM-DD format.' });
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(lastPeriodDate)) {
        return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD format.' });
      }
      const testDate = new Date(lastPeriodDate);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date. Please provide a valid date.' });
      }
      const cycleLengthNum = cycleLength ? parseInt(cycleLength) : 28;
      if (cycleLength && (isNaN(cycleLengthNum) || cycleLengthNum < 21 || cycleLengthNum > 35)) {
        return res.status(400).json({ error: 'Cycle length must be a number between 21 and 35 days.' });
      }
      const result = cycleService.calculateLutealPhase(lastPeriodDate, cycleLengthNum);
      res.json({ success: true, data: result });
    } catch (error) {
      console.error('Error calculating Luteal phase:', error);
      res.status(500).json({ error: 'An error occurred while calculating the Luteal phase.', message: error.message });
    }
  });

  // POST /api/daily-advice — full PrimeForm logic, Menstruatie Reset, Ziek/Geblesseerd, Lethargy/Elite overrides
  router.post('/daily-advice', async (req, res) => {
    console.log('🚀 BINNENKOMEND VERZOEK OP /api/daily-advice');
    console.log('📦 req.body:', req.body);
    try {
      const {
        userId,
        lastPeriodDate,
        cycleLength,
        sleep,
        rhr,
        rhrBaseline,
        hrv,
        hrvBaseline,
        readiness,
        menstruationStartedToday = false,
        isSickOrInjured = false
      } = req.body;

      const requiredFields = { userId, lastPeriodDate, sleep, rhr, rhrBaseline, hrv, hrvBaseline, readiness };
      const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => value === undefined || value === null)
        .map(([key]) => key);
      if (missingFields.length > 0) {
        return res.status(400).json({ error: 'Missing required fields', missingFields });
      }

      const todayIso = new Date().toISOString().split('T')[0];
      const periodStarted = Boolean(menstruationStartedToday);
      const effectiveLastPeriodDate = periodStarted ? todayIso : lastPeriodDate;

      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(effectiveLastPeriodDate)) {
        return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD format.' });
      }
      const testDate = new Date(effectiveLastPeriodDate);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date. Please provide a valid date.' });
      }

      const numericFields = {
        sleep: parseFloat(sleep),
        rhr: parseFloat(rhr),
        rhrBaseline: parseFloat(rhrBaseline),
        hrv: parseFloat(hrv),
        hrvBaseline: parseFloat(hrvBaseline),
        readiness: parseInt(readiness)
      };
      for (const [key, value] of Object.entries(numericFields)) {
        if (isNaN(value) || value < 0) {
          return res.status(400).json({ error: `Invalid value for ${key}. Must be a positive number.` });
        }
      }
      const cycleLengthNum = cycleLength ? parseInt(cycleLength) : 28;
      if (cycleLength && (isNaN(cycleLengthNum) || cycleLengthNum < 21 || cycleLengthNum > 35)) {
        return res.status(400).json({ error: 'Cycle length must be a number between 21 and 35 days.' });
      }
      if (numericFields.readiness < 1 || numericFields.readiness > 10) {
        return res.status(400).json({ error: 'Readiness must be between 1 and 10.' });
      }

      const cycleInfo = cycleService.calculateLutealPhase(effectiveLastPeriodDate, cycleLengthNum);

      let profileContext = null;
      try {
        if (db) {
          const userSnap = await db.collection('users').doc(String(userId)).get();
          if (userSnap.exists) profileContext = (userSnap.data() || {}).profile || null;
        }
      } catch (e) {
        console.error('❌ FIRESTORE FOUT:', e);
      }

      let detectedWorkout = '';
      try {
        if (db) detectedWorkout = await getDetectedWorkoutForAI(userId);
      } catch (e) {
        console.error('Detected workout fetch failed:', e);
      }

      const redFlags = cycleService.calculateRedFlags(
        numericFields.sleep,
        numericFields.rhr,
        numericFields.rhrBaseline,
        numericFields.hrv,
        numericFields.hrvBaseline,
        cycleInfo.isInLutealPhase
      );
      const isSickFlag = Boolean(isSickOrInjured);

      let recommendation = cycleService.determineRecommendation(
        numericFields.readiness,
        redFlags.count,
        cycleInfo.phaseName
      );

      const metricsForAI = {
        readiness: numericFields.readiness,
        sleep: numericFields.sleep,
        rhr: {
          current: numericFields.rhr,
          baseline: numericFields.rhrBaseline,
          adjustedBaseline: redFlags.details.rhr.adjustedBaseline,
          lutealCorrection: redFlags.details.rhr.lutealCorrection
        },
        hrv: {
          current: numericFields.hrv,
          baseline: numericFields.hrvBaseline,
          adjustedBaseline: redFlags.details.hrv.adjustedBaseline,
          lutealOffsetApplied: redFlags.details.hrv.lutealOffsetApplied
        }
      };
      let adviceContext = 'STANDARD';

      // Lethargy Override
      try {
        const isLutealPhase = cycleInfo.phaseName === 'Luteal' || cycleInfo.isInLutealPhase === true;
        if (!isSickFlag && isLutealPhase && numericFields.readiness >= 4 && numericFields.readiness <= 6) {
          const baselineHRV = metricsForAI.hrv.adjustedBaseline ?? metricsForAI.hrv.baseline;
          const currentHRV = metricsForAI.hrv.current;
          if (typeof baselineHRV === 'number' && baselineHRV > 0 && typeof currentHRV === 'number' && currentHRV >= baselineHRV * 1.05) {
            recommendation = {
              status: 'MAINTAIN',
              reasons: [...(recommendation.reasons || []), 'Lethargy Override: Luteale fase, readiness 4–6 maar HRV > 105% van baseline — hormonale lethargie, geen echte vermoeidheid. Focus op MAINTAIN (Aerobic Flow).']
            };
            adviceContext = 'LETHARGY_OVERRIDE';
          }
        }
      } catch (lethErr) {
        console.error('Lethargy Override evaluatie mislukt:', lethErr);
      }

      // Elite Override
      try {
        if (!isSickFlag && cycleInfo.phaseName === 'Menstrual') {
          const baselineHRV = metricsForAI.hrv.baseline ?? metricsForAI.hrv.adjustedBaseline;
          const currentHRV = metricsForAI.hrv.current;
          const hrvSafe = typeof baselineHRV === 'number' && baselineHRV > 0 && typeof currentHRV === 'number' && currentHRV >= baselineHRV * 0.98;
          if (numericFields.readiness >= 8 && hrvSafe) {
            recommendation = {
              status: 'PUSH',
              reasons: [...(recommendation.reasons || []), 'Elite Override: Menstruale fase, readiness 8+ en HRV ≥ 98% baseline — hormonale rebound, inflammatie onder controle. PUSH - ELITE REBOUND. Guardrail: houd data morgen in de gaten (mogelijke dip).']
            };
            adviceContext = 'ELITE_REBOUND';
          }
        }
      } catch (eliteErr) {
        console.error('Elite Override evaluatie mislukt:', eliteErr);
      }

      // Ziek/Geblesseerd — hard override
      if (isSickFlag) {
        recommendation = {
          status: 'REST',
          reasons: [...(recommendation.reasons || []), 'Gebruiker heeft ziek/geblesseerd gemeld – algoritme forceert Rust & Herstel.']
        };
        adviceContext = 'SICK_OVERRIDE';
      }

      const aiMessage = await generateAICoachingMessage(
        recommendation.status,
        cycleInfo.phaseName,
        metricsForAI,
        { count: redFlags.count, reasons: redFlags.reasons },
        profileContext,
        detectedWorkout,
        { isSickOrInjured: isSickFlag, periodStarted }
      );

      const responsePayload = {
        success: true,
        data: {
          status: recommendation.status,
          reasons: recommendation.reasons,
          aiMessage,
          cycleInfo: { phase: cycleInfo.phaseName, isLuteal: cycleInfo.isInLutealPhase, currentCycleDay: cycleInfo.currentCycleDay },
          metrics: {
            readiness: numericFields.readiness,
            redFlags: redFlags.count,
            redFlagDetails: redFlags.reasons,
            sleep: numericFields.sleep,
            rhr: { current: numericFields.rhr, baseline: numericFields.rhrBaseline, adjustedBaseline: redFlags.details.rhr.adjustedBaseline, lutealCorrection: redFlags.details.rhr.lutealCorrection },
            hrv: { current: numericFields.hrv, baseline: numericFields.hrvBaseline }
          }
        }
      };

      try {
        if (!db) throw new Error('Firestore is not initialized (db is null)');
        const userDocRef = db.collection('users').doc(String(userId));
        await userDocRef.collection('dailyLogs').add({
          timestamp: FieldValue.serverTimestamp(),
          date: new Date().toISOString().split('T')[0],
          userId: String(userId),
          metrics: responsePayload.data.metrics,
          cycleInfo: { ...responsePayload.data.cycleInfo, lastPeriodDate: effectiveLastPeriodDate, cycleLength: cycleLengthNum },
          cyclePhase: periodStarted ? 'Menstrual' : responsePayload.data.cycleInfo.phase,
          periodStarted,
          isSickOrInjured: isSickFlag,
          recommendation: { status: recommendation.status, reasons: recommendation.reasons },
          adviceContext,
          aiMessage,
          advice: aiMessage
        });
        if (periodStarted) {
          try {
            await userDocRef.set(
              {
                profile: {
                  ...(profileContext || {}),
                  cycleData: {
                    ...(profileContext?.cycleData || {}),
                    lastPeriod: effectiveLastPeriodDate,
                    lastPeriodDate: effectiveLastPeriodDate,
                    avgDuration: cycleLengthNum
                  }
                }
              },
              { merge: true }
            );
          } catch (cycleErr) {
            console.error('⚠️ Kon cycleData niet bijwerken:', cycleErr);
          }
        }
      } catch (error) {
        console.error('❌ FIRESTORE FOUT:', error);
      }

      res.json(responsePayload);
    } catch (error) {
      console.error('Error calculating daily advice:', error);
      res.status(500).json({ error: 'An error occurred while calculating daily advice.', message: error.message });
    }
  });

  // POST /api/save-checkin — save to root collection daily_logs (no overrides, adviceContext STANDARD)
  router.post('/save-checkin', async (req, res) => {
    try {
      const { userId, lastPeriodDate, cycleLength, sleep, rhr, rhrBaseline, hrv, hrvBaseline, readiness } = req.body;
      const requiredFields = { userId, lastPeriodDate, sleep, rhr, rhrBaseline, hrv, hrvBaseline, readiness };
      const missingFields = Object.entries(requiredFields)
        .filter(([key, value]) => value === undefined || value === null)
        .map(([key]) => key);
      if (missingFields.length > 0) {
        return res.status(400).json({ error: 'Missing required fields', missingFields });
      }
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(lastPeriodDate)) {
        return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD format.' });
      }
      const testDate = new Date(lastPeriodDate);
      if (isNaN(testDate.getTime())) {
        return res.status(400).json({ error: 'Invalid date. Please provide a valid date.' });
      }
      const numericFields = {
        sleep: parseFloat(sleep),
        rhr: parseFloat(rhr),
        rhrBaseline: parseFloat(rhrBaseline),
        hrv: parseFloat(hrv),
        hrvBaseline: parseFloat(hrvBaseline),
        readiness: parseInt(readiness)
      };
      for (const [key, value] of Object.entries(numericFields)) {
        if (isNaN(value) || value < 0) {
          return res.status(400).json({ error: `Invalid value for ${key}. Must be a positive number.` });
        }
      }
      const cycleLengthNum = cycleLength ? parseInt(cycleLength) : 28;
      if (cycleLength && (isNaN(cycleLengthNum) || cycleLengthNum < 21 || cycleLengthNum > 35)) {
        return res.status(400).json({ error: 'Cycle length must be a number between 21 and 35 days.' });
      }
      if (numericFields.readiness < 1 || numericFields.readiness > 10) {
        return res.status(400).json({ error: 'Readiness must be between 1 and 10.' });
      }

      const cycleInfo = cycleService.calculateLutealPhase(lastPeriodDate, cycleLengthNum);
      const redFlags = cycleService.calculateRedFlags(
        numericFields.sleep,
        numericFields.rhr,
        numericFields.rhrBaseline,
        numericFields.hrv,
        numericFields.hrvBaseline,
        cycleInfo.isInLutealPhase
      );
      const recommendation = cycleService.determineRecommendation(
        numericFields.readiness,
        redFlags.count,
        cycleInfo.phaseName
      );

      const checkinData = {
        userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        date: new Date().toISOString().split('T')[0],
        metrics: {
          sleep: numericFields.sleep,
          rhr: numericFields.rhr,
          rhrBaseline: numericFields.rhrBaseline,
          hrv: numericFields.hrv,
          hrvBaseline: numericFields.hrvBaseline,
          readiness: numericFields.readiness
        },
        cycleInfo: {
          lastPeriodDate,
          cycleLength: cycleLengthNum,
          phase: cycleInfo.phaseName,
          isLuteal: cycleInfo.isInLutealPhase,
          currentCycleDay: cycleInfo.currentCycleDay
        },
        redFlags: { count: redFlags.count, reasons: redFlags.reasons, details: redFlags.details },
        recommendation: { status: recommendation.status, reasons: recommendation.reasons },
        adviceContext: 'STANDARD'
      };

      let docRef;
      try {
        docRef = await db.collection('daily_logs').add(checkinData);
      } catch (firestoreError) {
        console.error('Firestore save failed (save-checkin):', firestoreError);
        return res.status(200).json({
          success: false,
          message: 'Check-in berekend, maar opslaan in Firestore is mislukt.',
          firestoreError: firestoreError.message,
          data: checkinData
        });
      }

      // --- Rolling averages: 7d & 28d HRV/RHR, stored on user metrics ---
      try {
        if (db) {
          const userIdStr = String(userId);
          const logsSnap = await db
            .collection('daily_logs')
            .where('userId', '==', userIdStr)
            .orderBy('date', 'desc')
            .limit(60)
            .get();

          const today = new Date();
          const toIso = (d) => d.toISOString().slice(0, 10);
          const cutoff7 = new Date(today);
          cutoff7.setDate(cutoff7.getDate() - 7);
          const cutoff28 = new Date(today);
          cutoff28.setDate(cutoff28.getDate() - 28);
          const cutoff7Str = toIso(cutoff7);
          const cutoff28Str = toIso(cutoff28);

          const logs = logsSnap.docs
            .map((d) => d.data() || {})
            .filter((d) => typeof d.date === 'string' && d.date.length >= 10);

          const inWindow = (days) => (log) => {
            const dateStr = log.date.slice(0, 10);
            return days === 7 ? dateStr >= cutoff7Str : dateStr >= cutoff28Str;
          };

          const avg = (arr) => {
            const nums = arr
              .map((v) => Number(v))
              .filter((v) => Number.isFinite(v));
            if (!nums.length) return null;
            const sum = nums.reduce((s, v) => s + v, 0);
            return Math.round((sum / nums.length) * 10) / 10;
          };

          const metrics7 = logs.filter(inWindow(7)).map((l) => l.metrics || {});
          const metrics28 = logs.filter(inWindow(28)).map((l) => l.metrics || {});

          const hrv7d = avg(metrics7.map((m) => m.hrv));
          const hrv28d = avg(metrics28.map((m) => m.hrv));
          const rhr7d = avg(metrics7.map((m) => m.rhr));
          const rhr28d = avg(metrics28.map((m) => m.rhr));

          const userRef = db.collection('users').doc(userIdStr);
          await userRef.set(
            {
              // Latest subjective readiness for today
              readiness: numericFields.readiness,
              metrics: {
                hrv7d,
                hrv28d,
                rhr7d,
                rhr28d,
                lastCheckin: {
                  date: checkinData.date,
                  readiness: numericFields.readiness,
                  hrv: numericFields.hrv,
                  rhr: numericFields.rhr
                }
              }
            },
            { merge: true }
          );
        }
      } catch (metricsErr) {
        console.error('Failed to update rolling HRV/RHR metrics on user document:', metricsErr);
        // Do not fail the check-in response if metric aggregation fails
      }

      res.json({ success: true, message: 'Check-in data saved successfully', data: { id: docRef.id, ...checkinData } });
    } catch (error) {
      console.error('Error saving check-in:', error);
      res.status(500).json({ error: 'An error occurred while saving check-in data.', message: error.message });
    }
  });

  return router;
}

module.exports = { createDailyRouter };

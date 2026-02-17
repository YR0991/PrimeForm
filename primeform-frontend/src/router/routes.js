const adminGuard = () => true

const routes = [
  {
    path: '/intake',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IntakeStepper.vue') }],
  },
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/IndexPage.vue') }],
  },
  {
    path: '/loading',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LoadingPage.vue'), meta: { requiresAuth: true } }],
  },
  {
    path: '/onboarding',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/onboarding/OnboardingPage.vue'), meta: { requiresAuth: true } }],
  },
  {
    path: '/insights',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/InsightsPage.vue'), meta: { requiresAuth: true } }],
  },
  {
    path: '/profile',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/user/ProfilePage.vue'), meta: { requiresAuth: true } }],
  },
  {
    path: '/dashboard',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/dashboard/UserDashboard.vue') }],
  },
  {
    path: '/login',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/LoginPage.vue') }],
  },
  {
    path: '/auth/strava/callback',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/auth/StravaCallbackPage.vue') }],
  },
  {
    path: '/coach',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('pages/coach/CoachDashboard.vue') },
      {
        path: 'athlete/:id',
        name: 'CoachDeepDive',
        component: () => import('pages/coach/CoachDeepDive.vue'),
      },
    ],
  },
  {
    path: '/admin',
    beforeEnter: adminGuard,
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/admin/AdminPage.vue') }],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes

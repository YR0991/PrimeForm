// Admin email check function
const isAdminEmail = (email) => {
  return email === 'yoramroemersma50@gmail.com'
}

// Admin route guard
const adminGuard = (to, from, next) => {
  // Simple check: prompt for email (in production, use Firebase Auth)
  const storedEmail = localStorage.getItem('admin_email')
  
  if (storedEmail && isAdminEmail(storedEmail)) {
    next()
    return
  }
  
  // Prompt for email
  const email = prompt('Voer je admin e-mailadres in:')
  
  if (email && isAdminEmail(email)) {
    localStorage.setItem('admin_email', email)
    next()
  } else {
    alert('Access Denied: Alleen beheerders hebben toegang tot deze pagina.')
    next('/')
  }
}

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
    path: '/dashboard',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/dashboard/UserDashboard.vue') }],
  },
  {
    path: '/coach',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/coach/CoachDashboard.vue') }],
    beforeEnter: adminGuard
  },
  {
    path: '/admin',
    component: () => import('layouts/MainLayout.vue'),
    children: [{ path: '', component: () => import('pages/admin/AdminPage.vue') }],
    beforeEnter: adminGuard
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue'),
  },
]

export default routes

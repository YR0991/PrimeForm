// Admin email check function
const isAdminEmail = (email) => {
  return email === 'yoramroemersma50@gmail.com'
}

// Admin route guard (Vue Router 4 syntax)
const adminGuard = () => {
  // Simple check: prompt for email (in production, use Firebase Auth)
  const storedEmail = localStorage.getItem('admin_email')
  
  if (storedEmail && isAdminEmail(storedEmail)) {
    return true
  }
  
  // Prompt for email
  const email = prompt('Voer je admin e-mailadres in:')
  
  if (email && isAdminEmail(email)) {
    localStorage.setItem('admin_email', email)
    return true
  } else {
    alert('Access Denied: Alleen beheerders hebben toegang tot deze pagina.')
    return { path: '/' }
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

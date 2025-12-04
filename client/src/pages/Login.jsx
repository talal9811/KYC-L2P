import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { Shield, Lock, Mail, Eye, EyeOff, Moon, Sun } from 'lucide-react'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/home')
    } catch (err) {
      let message = 'Failed to sign in with Firebase'

      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        message = 'Incorrect email or password'
      } else if (err?.code === 'auth/user-not-found') {
        message = 'No account found for this email'
      } else if (err?.code === 'auth/invalid-email') {
        message = 'Invalid email address'
      }

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-slate-900 dark:via-blue-900 dark:to-indigo-900 relative overflow-hidden">
      {/* Theme Toggle Button */}
      <button
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          toggleTheme()
        }}
        className="fixed top-4 right-4 z-50 p-3 rounded-xl bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-110"
        aria-label="Toggle theme"
        type="button"
      >
        {theme === 'dark' ? (
          <Sun className="w-5 h-5 text-yellow-500" />
        ) : (
          <Moon className="w-5 h-5 text-slate-700" />
        )}
      </button>

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow" />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
          style={{ animationDelay: '1s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse-slow"
          style={{ animationDelay: '2s' }}
        />
      </div>

      {/* Main Content */}
      <div className="relative z-10 w-full max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          {/* Left Panel – Brand & Benefits */}
          <div className="space-y-6 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight">
                  L2P Brokerage Checker
                </h1>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                  Secure Compliance Verification System
                </p>
              </div>
            </div>

            <div className="hidden md:block">
              <h2 className="text-2xl md:text-3xl font-semibold leading-snug mb-3">
                Stay compliant with confidence.
              </h2>
              <p className="text-sm md:text-base text-slate-600 dark:text-slate-400 mb-4">
                Centralize all your KYC & watchlist checks in one easy-to-use dashboard,
                backed by real-time monitoring and detailed audit trails.
              </p>

              <ul className="space-y-3 text-sm md:text-base">
                <li className="flex gap-3">
                  <span className="mt-1 h-5 w-5 flex items-center justify-center rounded-full bg-blue-600/10 text-blue-600 text-xs">
                    1
                  </span>
                  <span>Instant sanctions & PEP screening across global lists.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-5 w-5 flex items-center justify-center rounded-full bg-blue-600/10 text-blue-600 text-xs">
                    2
                  </span>
                  <span>Automated alerts for high-risk matches and changes.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-5 w-5 flex items-center justify-center rounded-full bg-blue-600/10 text-blue-600 text-xs">
                    3
                  </span>
                  <span>Exportable audit logs for regulators and internal reviews.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Right Panel – Login Card */}
          <div className="glass-card rounded-3xl p-8 md:p-10 shadow-2xl animate-fade-in">
            {/* Logo on top (for mobile & extra branding) */}
            <div className="text-center mb-8 md:mb-6">
              <div className="inline-flex items-center justify-center w-auto h-auto mb-2">
                <img src="/logo.png" alt="Logo" className="w-40 h-24 object-contain" />
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-50">
                Welcome back
              </h2>
              <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                Sign in to access your brokerage compliance dashboard.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="input-modern pl-12"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="block text-sm font-semibold text-slate-700 dark:text-slate-300"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400" />
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="input-modern pl-12 pr-12"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl text-sm animate-slide-up">
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Authenticating...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center mt-6 text-slate-500 dark:text-slate-400 text-xs md:text-sm">
          © 2025 KYC Watchlist Checker. All rights reserved.
        </p>
      </div>
    </div>
  )
}

export default Login

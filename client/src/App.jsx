import { Navigate, Route, Routes } from 'react-router-dom'
import { lazy, Suspense, useEffect, useState } from 'react'
import axios from 'axios'
import { useDispatch, useSelector } from 'react-redux'
import { setUserData } from './redux/userSlice'
import { ServerUrl } from './config/api'

const Home = lazy(() => import('./pages/Home'));
const Auth = lazy(() => import('./pages/Auth'));
const InterviewPage = lazy(() => import('./pages/InterviewPage'));
const InterviewHistory = lazy(() => import('./pages/InterviewHistory'));
const Pricing = lazy(() => import('./pages/Pricing'));
const InterviewReport = lazy(() => import('./pages/InterviewReport'));

function ProtectedRoute({ children, isAuthReady }) {
  const { userData } = useSelector((state) => state.user);
  if (!isAuthReady) {
    return <div className="flex min-h-screen items-center justify-center text-gray-600">Checking your session…</div>;
  }
  return userData ? children : <Navigate to="/auth" replace />;
}

function App() {

  const dispatch = useDispatch()
  const { userData } = useSelector((state) => state.user)
  const [isAuthReady, setIsAuthReady] = useState(false)
  useEffect(()=>{
    const getUser = async () => {
      try {
        const result = await axios.get(ServerUrl + "/api/user/current-user", {withCredentials:true})
        dispatch(setUserData(result.data))
      } catch (error) {
        console.log(error)
        dispatch(setUserData(null))
      } finally {
        setIsAuthReady(true)
      }
    }
    getUser()

  },[dispatch])
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-gray-600">Loading InterviewIQ…</div>}>
      <Routes>
        <Route path='/' element={<Navigate to='/auth' replace />}/>
        <Route path='/auth' element={isAuthReady && userData ? <Navigate to='/dashboard' replace /> : <Auth/>}/>
        <Route path='/dashboard' element={<ProtectedRoute isAuthReady={isAuthReady}><Home/></ProtectedRoute>}/>
        <Route path='/interview' element={<ProtectedRoute isAuthReady={isAuthReady}><InterviewPage/></ProtectedRoute>}/>
        <Route path='/history' element={<ProtectedRoute isAuthReady={isAuthReady}><InterviewHistory/></ProtectedRoute>}/>
        <Route path='/pricing' element={<ProtectedRoute isAuthReady={isAuthReady}><Pricing/></ProtectedRoute>}/>
        <Route path='/report/:id' element={<ProtectedRoute isAuthReady={isAuthReady}><InterviewReport/></ProtectedRoute>}/>
        <Route path='*' element={<Navigate to='/auth' replace />}/>
      </Routes>
    </Suspense>
  )
}

export default App

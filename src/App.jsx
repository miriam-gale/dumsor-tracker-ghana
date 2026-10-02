import { useState, useCallback } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { MainLayout } from './layouts/MainLayout'
import { useOutages } from './hooks/useOutages'
import { useDarkMode } from './hooks/useDarkMode'
import { ReportModal } from './components/ReportModal'
import { Toast } from './components/ui/Toast'

import Landing from './pages/Landing'
import Dashboard from './pages/Dashboard'
import MapPage from './pages/MapPage'
import ReportPage from './pages/ReportPage'
import FeedPage from './pages/FeedPage'
import AnalyticsPage from './pages/AnalyticsPage'

export default function App() {
  const [dark, setDark] = useDarkMode()
  const { outages, addOutage, resolveOutage, stats } = useOutages()
  const [modalOpen, setModalOpen] = useState(false)
  const [toast, setToast] = useState({ visible: false, title: '', body: '' })

  const openModal = useCallback(() => setModalOpen(true), [])
  const closeModal = useCallback(() => setModalOpen(false), [])

  const handleReportSubmit = useCallback(async (formData) => {
    try {
      const newOutage = await addOutage(formData)
      setModalOpen(false)
      setToast({
        visible: true,
        title: 'Report submitted!',
        body: `${newOutage.town}, ${newOutage.region} — report added to the feed.`,
      })
    } catch (err) {
      setModalOpen(false)
      setToast({
        visible: true,
        title: 'Submission failed',
        body: err.message || 'Could not submit your report. Please try again.',
      })
    }
  }, [addOutage])

  const dismissToast = useCallback(() => setToast(t => ({ ...t, visible: false })), [])

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <MainLayout dark={dark} setDark={setDark} openModal={openModal}>
              <Landing dark={dark} setDark={setDark} outages={outages} stats={stats} openModal={openModal} />
            </MainLayout>
          }
        />
        <Route
          path="/dashboard"
          element={
            <MainLayout dark={dark} setDark={setDark} openModal={openModal}>
              <Dashboard outages={outages} stats={stats} openModal={openModal} />
            </MainLayout>
          }
        />
        <Route
          path="/map"
          element={
            <MainLayout dark={dark} setDark={setDark} openModal={openModal}>
              <MapPage outages={outages} />
            </MainLayout>
          }
        />
        <Route
          path="/report"
          element={
            <MainLayout dark={dark} setDark={setDark} openModal={openModal}>
              <ReportPage addOutage={addOutage} />
            </MainLayout>
          }
        />
        <Route
          path="/feed"
          element={
            <MainLayout dark={dark} setDark={setDark} openModal={openModal}>
              <FeedPage outages={outages} openModal={openModal} resolveOutage={resolveOutage} />
            </MainLayout>
          }
        />
        <Route
          path="/analytics"
          element={
            <MainLayout dark={dark} setDark={setDark} openModal={openModal}>
              <AnalyticsPage outages={outages} stats={stats} openModal={openModal} />
            </MainLayout>
          }
        />
      </Routes>

      <ReportModal key={modalOpen ? 'open' : 'closed'} isOpen={modalOpen} onClose={closeModal} onSubmit={handleReportSubmit} />
      <Toast visible={toast.visible} title={toast.title} body={toast.body} onClose={dismissToast} />
    </BrowserRouter>
  )
}

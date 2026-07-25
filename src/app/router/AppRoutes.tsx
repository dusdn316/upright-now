import { Navigate, Route, Routes } from 'react-router-dom'
import { LandingDashboard } from '@/app/routes/LandingDashboard'
import { OnboardingName } from '@/app/routes/OnboardingName'
import { Profiles } from '@/app/routes/Profiles'
import { CameraIntro } from '@/app/routes/CameraIntro'
import { SessionSetup } from '@/app/routes/SessionSetup'
import { Session } from '@/app/routes/Session'
import { Result } from '@/app/routes/Result'
import { QaLab } from '@/app/routes/QaLab'
import { Calibration } from '@/app/routes/Calibration'
import { Stretch } from '@/app/routes/Stretch'
import { History } from '@/app/routes/History'
import { Growth } from '@/app/routes/Growth'
import { Shop } from '@/app/routes/Shop'
import { Settings } from '@/app/routes/Settings'
import { Room, RoomNew } from '@/app/routes/Placeholder'
import { featureFlags } from '@/lib/feature-flags/flags'

/** 라우트 — docs/04_IA.md §1 */
export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingDashboard />} />
      <Route path="/onboarding/name" element={<OnboardingName />} />
      <Route path="/profiles" element={<Profiles />} />
      <Route path="/camera" element={<CameraIntro />} />
      <Route path="/calibration" element={<Calibration />} />

      <Route path="/session/setup" element={<SessionSetup />} />
      <Route path="/session/:sessionId" element={<Session />} />

      <Route path="/stretch" element={<Stretch />} />
      <Route path="/stretch/:routineId" element={<Stretch />} />

      <Route path="/result/:sessionId" element={<Result />} />

      <Route path="/history" element={<History />} />
      <Route path="/growth" element={<Growth />} />
      <Route path="/shop" element={<Shop />} />

      <Route path="/room/new" element={<RoomNew />} />
      <Route path="/room/:roomCode" element={<Room />} />

      <Route path="/settings" element={<Settings />} />

      {/* 운영 빌드에서는 라우트 자체를 등록하지 않습니다. (docs/02 FR-017) */}
      {featureFlags.qaLab && <Route path="/lab" element={<QaLab />} />}

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

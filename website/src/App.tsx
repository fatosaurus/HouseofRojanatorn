import { Route, Routes } from 'react-router-dom'
import {
  AtelierPage,
  BespokePage,
  CollectionPage,
  FoundationPage,
  HomePage,
  JournalPage,
  StoryPage
} from './MarketingPages'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/story" element={<StoryPage />} />
      <Route path="/collection" element={<CollectionPage />} />
      <Route path="/atelier" element={<AtelierPage />} />
      <Route path="/foundation" element={<FoundationPage />} />
      <Route path="/journal" element={<JournalPage />} />
      <Route path="/bespoke" element={<BespokePage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  )
}

export default App

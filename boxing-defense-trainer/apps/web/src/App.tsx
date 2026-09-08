/**
 * Responsibility: the application root. It picks which page to render and hosts
 * app-wide providers. Nothing else belongs here.
 */
import { TrainerPage } from './pages'

export default function App() {
  return <TrainerPage />
}

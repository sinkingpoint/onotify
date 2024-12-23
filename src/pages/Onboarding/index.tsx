import { ConfigUpload } from "./config-upload";
import "./style.css";

export function Onboarding() {
  return (
    <div class="home">
      <h1 class="text-3xl font-bold my-3">Get started sending your alerts</h1>
      <ConfigUpload />
    </div>
  );
}

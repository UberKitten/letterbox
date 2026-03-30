import { getLoginUrl } from "../api";

export default function LoginScreen() {
  return (
    <div class="login-screen">
      <div class="login-card">
        <h1 class="login-title">Letterbox</h1>
        <p class="login-subtitle">
          A clean reading experience for your email newsletters and RSS feeds.
          Sign in with your Microsoft account to get started.
        </p>
        <a href={getLoginUrl()} class="login-btn">
          Sign in with Microsoft
        </a>
      </div>
    </div>
  );
}

import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home.jsx";
import Login from "@/pages/Login.jsx";
import ExamSetup from "@/pages/ExamSetup.jsx";
import Demo from "@/pages/Demo.jsx";
import PrepRoom from "@/pages/PrepRoom.jsx";
import Profile from "@/pages/Profile.jsx";
import Exam from "@/pages/Exam.jsx";
import Result from "@/pages/Result.jsx";
import Review from "@/pages/Review.jsx";
import { useAttempt } from "@/lib/useAttempt.js";
import { useAuth } from "@/lib/useAuth.js";

export default function App() {
  // One attempt lives above the router so navigating between result and review
  // never refetches or loses the answers.
  const attempt = useAttempt();
  const auth = useAuth();

  return (
    <Routes>
      <Route path="/" element={<Home auth={auth} attempt={attempt} />} />
      <Route path="/login" element={<Login auth={auth} />} />
      <Route path="/start" element={<ExamSetup attempt={attempt} auth={auth} />} />
      <Route path="/demo" element={<Demo attempt={attempt} auth={auth} />} />
      <Route path="/prepare" element={<PrepRoom auth={auth} />} />
      <Route path="/profile" element={<Profile auth={auth} />} />
      <Route path="/exam" element={<Exam attempt={attempt} auth={auth} />} />
      <Route path="/result" element={<Result attempt={attempt} auth={auth} />} />
      <Route path="/review" element={<Review attempt={attempt} auth={auth} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

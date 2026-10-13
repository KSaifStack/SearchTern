import { useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/Feedback.css";

export default function Feedback() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function submitFeedback(e: React.FormEvent) {
    e.preventDefault();

    if (!supabase) {
      setStatus("Feedback is not connected yet.");
      return;
    }

    if (!message.trim()) {
      setStatus("Please write something first.");
      return;
    }

    const { error } = await supabase.from("feedback").insert({
      message: message.trim(),
    });

    if (error) {
      console.error(error);
      setStatus("Something went wrong. Please try again.");
      return;
    }

    setMessage("");
    setStatus("Thanks, your feedback was sent.");
  }

  return (
    <section className="feedback">
      <form className="feedback-form" onSubmit={submitFeedback}>
        <div className="feedback-field">
          <label htmlFor="feedback-message">Feedback</label>
          <textarea
            id="feedback-message"
            placeholder="What would you change?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
          />
        </div>

        <button type="submit" className="feedback-submit">
          Send Feedback
        </button>

        {status && <p className="feedback-status">{status}</p>}
      </form>
    </section>
  );
}
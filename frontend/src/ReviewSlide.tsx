import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import "../styles/ReviewSlide.css";

type Review = {
  id: number;
  name: string;
  rating: number;
  review: string;
};

export default function ReviewSlide() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [name, setName] = useState("");
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadReviews();
  }, []);

  async function loadReviews() {
    if (!supabase) return;

    const { data, error } = await supabase
      .from("reviews")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setReviews(data);
    }
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();

    if (!supabase) {
      setMessage("Reviews are not connected yet.");
      return;
    }

    if (!name.trim() || !review.trim()) {
      setMessage("Please enter your name and review.");
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      name: name.trim(),
      rating: rating,
      review: review.trim(),
    });

    if (error) {
      console.error(error);
      setMessage("Something went wrong. Please try again.");
      return;
    }

    setName("");
    setRating(5);
    setReview("");
    setMessage("Thank you for your review!");

    loadReviews();
  }

  return (
    <section className="review-slide">
      <div className="review-content">
        <h2>Leave a Review</h2>

        <p className="review-intro">
          Tell us what you think about your experience.
        </p>

        <form className="review-form" onSubmit={submitReview}>
          <label htmlFor="review-name">Name</label>

          <input
            id="review-name"
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <label>Rating</label>

          <div className="rating">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                type="button"
                key={star}
                className={star <= rating ? "star active" : "star"}
                onClick={() => setRating(star)}
                aria-label={`${star} star rating`}
              >
                ★
              </button>
            ))}
          </div>

          <label htmlFor="review-text">Review</label>

          <textarea
            id="review-text"
            placeholder="Write your review..."
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={5}
          />

          <button type="submit" className="submit-review">
            Submit Review
          </button>

          {message && <p className="review-message">{message}</p>}
        </form>

        <div className="existing-reviews">
          <h3>Recent Reviews</h3>

          {reviews.length === 0 ? (
            <p className="no-reviews">No reviews yet.</p>
          ) : (
            reviews.slice(0, 3).map((item) => (
              <div className="review-card" key={item.id}>
                <div className="review-header">
                  <strong>{item.name}</strong>

                  <div className="review-stars">
                    {"★".repeat(item.rating)}
                    {"☆".repeat(5 - item.rating)}
                  </div>
                </div>

                <p>{item.review}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}

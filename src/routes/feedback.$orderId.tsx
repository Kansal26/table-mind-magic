import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, Loader2, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { checkFeedbackExistsFn, submitFeedbackFn } from "@/lib/wallet.functions";
import { fetchBillFn } from "@/lib/ordering.functions";
import { useAuth } from "@/hooks/useAuth";

type FeedbackSearch = {
  table: string;
  session: string;
};

export const Route = createFileRoute("/feedback/$orderId")({
  validateSearch: (search: Record<string, unknown>): FeedbackSearch => ({
    table: String(search["table"] ?? ""),
    session: String(search["session"] ?? ""),
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { orderId } = Route.useParams();
  const searchParams = Route.useSearch() as any;
  const qrToken = searchParams["table"];
  const sessionId = searchParams["session"];
  const navigate = useNavigate();

  const { user } = useAuth();
  
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [successData, setSuccessData] = useState<{ creditEarned: number, pointsValue: number, isLoyaltyEnabled: boolean } | null>(null);

  // Check if feedback already exists
  const existsQuery = useQuery({
    queryKey: ["feedback-exists", orderId],
    queryFn: () => checkFeedbackExistsFn({ data: { orderId } }),
  });

  const loyaltyQuery = useQuery({
    queryKey: ["loyalty", qrToken, user?.id],
    queryFn: async () => {
      const { getLoyaltyDataFn } = await import("@/lib/wallet.functions");
      return getLoyaltyDataFn({ data: { qrToken, userId: user!.id } });
    },
    enabled: !!user && !!qrToken,
  });

  useEffect(() => {
    if (existsQuery.data?.exists) {
      navigate({ to: "/checkout", search: { table: qrToken, order: orderId, session: sessionId } });
    }
  }, [existsQuery.data, navigate, qrToken, orderId, sessionId]);

  // Load order lines to determine question
  const orderQuery = useQuery({
    queryKey: ["feedback-order", orderId],
    queryFn: () => fetchBillFn({ data: { qrToken, orderId } }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const structuredAnswers = answers;
      return await submitFeedbackFn({
        data: {
          qrToken,
          orderId,
          rating,
          comment,
          structuredAnswers,
        },
      });
    },
    onSuccess: (data: any) => {
      if (data?.error === "409_CONFLICT") {
        navigate({ to: "/checkout", search: { table: qrToken, order: orderId, session: sessionId } });
        return;
      }
      setSuccessData({
        creditEarned: data.creditEarned || 0,
        pointsValue: data.pointsValue || 0,
        isLoyaltyEnabled: data.isLoyaltyEnabled || false
      });
      setTimeout(() => {
        navigate({ to: "/checkout", search: { table: qrToken, order: orderId, session: sessionId } });
      }, 3000);
    },
  });

  if (existsQuery.isLoading || orderQuery.isLoading || existsQuery.data?.exists || (user && loyaltyQuery.isLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const selectedQuestions = useMemo(() => {
    const lines = orderQuery.data?.lines || [];
    const hasSpicy = lines.some((l: any) => l.menu_item.dietary_tags?.includes("spicy") || l.menu_item.allergens?.includes("spicy"));
    const hasDessert = lines.some((l: any) => l.menu_item.category?.toLowerCase().includes("dessert"));

    const FOOD_QUESTIONS = [
      { id: "food_taste", text: "How was the taste?", options: ["Perfect", "Good", "Needs improvement"] },
      { id: "food_portion", text: "Was the portion size right?", options: ["Too much", "Just right", "Too little"] },
      { id: "food_freshness", text: "How fresh did it feel?", options: ["Very fresh", "Okay", "Not fresh"] }
    ];
    
    const SERVICE_QUESTIONS = [
      { id: "service_wait", text: "How was the wait time?", options: ["Fast", "Reasonable", "Too long"] },
      { id: "service_staff", text: "How were the staff?", options: ["Excellent", "Fine", "Could be better"] },
      { id: "service_ambience", text: "How was the overall ambience?", options: ["Loved it", "It was fine", "Not great"] }
    ];
    
    const VALUE_QUESTIONS = [
      { id: "value_worth", text: "Was it worth the price?", options: ["Yes", "Somewhat", "Not really"] },
      { id: "value_again", text: "Would you order again?", options: ["Definitely", "Maybe", "Probably not"] }
    ];

    type Question = { id: string; text: string; options: string[] };
    const questions: Question[] = [];

    // Food Question
    if (hasSpicy) {
      questions.push({ id: "food_spicy", text: "How was the spice level?", options: ["Yes", "Just right", "Too mild", "Too spicy"] });
    } else if (hasDessert) {
      questions.push({ id: "food_sweetness", text: "How was the sweetness?", options: ["Perfect", "Too sweet", "Not sweet enough"] });
    } else {
      const q = FOOD_QUESTIONS[Math.floor(Math.random() * FOOD_QUESTIONS.length)];
      if (q) questions.push(q);
    }

    // Service Question
    const sQ = SERVICE_QUESTIONS[Math.floor(Math.random() * SERVICE_QUESTIONS.length)];
    if (sQ) questions.push(sQ);

    // Value Question (50% chance)
    if (Math.random() > 0.5) {
      const vQ = VALUE_QUESTIONS[Math.floor(Math.random() * VALUE_QUESTIONS.length)];
      if (vQ) questions.push(vQ);
    }

    return questions;
  }, [orderQuery.data?.lines]);

  const settings = loyaltyQuery.data?.settings;
  const isLoyaltyEnabled = settings?.enabled || false;

  const earnedSoFar = isLoyaltyEnabled 
    ? (rating > 0 ? (settings.points_for_rating || 0) : 0) + 
      (comment.trim().length > 10 ? (settings.points_for_comment || 0) : 0) + 
      (Object.keys(answers).length * (settings.points_for_question || 0))
    : 0;

  if (successData !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="size-8" />
          </div>
          <h1 className="font-display text-2xl text-foreground">Thank you!</h1>
          <p className="mt-2 text-muted-foreground">Your feedback has been submitted.</p>
          {successData.isLoyaltyEnabled && successData.creditEarned > 0 && (
            <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-lg font-medium text-primary">You earned {successData.creditEarned} points!</p>
              <p className="mt-1 text-sm text-muted-foreground">(worth up to ₹{successData.pointsValue} at this restaurant)</p>
            </div>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-5 pb-16">
      <div className="mx-auto max-w-lg">
        <button
          type="button"
          onClick={() => navigate({ to: "/checkout", search: { table: qrToken, order: orderId, session: sessionId } })}
          className="mt-6 inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> Skip feedback
        </button>

        <h1 className="mt-6 font-display text-3xl text-foreground">How was your meal?</h1>
        {isLoyaltyEnabled && (
          <p className="mt-2 text-muted-foreground">You've earned <span className="font-semibold text-primary">{earnedSoFar} points</span> so far.</p>
        )}

        <div className="mt-8">
          <Label className="text-base">Rate your experience</Label>
          <div className="mt-3 flex gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  className={`size-10 ${
                    rating >= star
                      ? "fill-primary text-primary"
                      : "fill-transparent text-muted-foreground/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <Label className="text-base">Any thoughts? (Optional)</Label>
          {isLoyaltyEnabled && !!settings?.points_for_comment && (
            <p className="mb-3 text-sm text-muted-foreground">Earn {settings.points_for_comment} extra points for leaving a comment.</p>
          )}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you loved..."
            className="h-24 resize-none"
          />
        </div>

        {selectedQuestions.map(q => (
          <div key={q.id} className="mt-8 rounded-xl border border-border bg-card p-4 shadow-soft">
            <Label className="text-base text-foreground">{q.text}</Label>
            {isLoyaltyEnabled && !!settings?.points_for_question && (
              <p className="mb-4 mt-1 text-sm text-muted-foreground">Earn {settings.points_for_question} extra points for answering.</p>
            )}
            <RadioGroup value={answers[q.id] || ""} onValueChange={(val) => setAnswers(prev => ({ ...prev, [q.id]: val }))}>
              {q.options.map((opt) => (
                <div key={opt} className="flex items-center space-x-2 py-2">
                  <RadioGroupItem value={opt} id={`${q.id}-${opt}`} />
                  <Label htmlFor={`${q.id}-${opt}`} className="cursor-pointer font-normal text-foreground">
                    {opt}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        ))}

        <Button
          className="mt-8 w-full"
          size="lg"
          disabled={rating === 0 || submitMutation.isPending}
          onClick={() => submitMutation.mutate()}
        >
          {submitMutation.isPending && <Loader2 className="mr-2 animate-spin size-4" />}
          Submit Feedback
        </Button>
      </div>
    </main>
  );
}

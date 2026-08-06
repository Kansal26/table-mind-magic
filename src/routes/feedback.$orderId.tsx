import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Star, Loader2, Sparkles, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { checkFeedbackExistsFn, submitFeedbackFn } from "@/lib/wallet.functions";
import { fetchBillFn } from "@/lib/ordering.functions";

type FeedbackSearch = {
  table: string;
  session: string;
};

export const Route = createFileRoute("/feedback/$orderId")({
  validateSearch: (search: Record<string, unknown>): FeedbackSearch => ({
    table: String(search.table ?? ""),
    session: String(search.session ?? ""),
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { orderId } = Route.useParams();
  const searchParams = Route.useSearch() as any;
  const qrToken = searchParams.table;
  const sessionId = searchParams.session;
  const navigate = useNavigate();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [answer, setAnswer] = useState<string>("");
  const [successCredits, setSuccessCredits] = useState<number | null>(null);

  // Check if feedback already exists
  const existsQuery = useQuery({
    queryKey: ["feedback-exists", orderId],
    queryFn: () => checkFeedbackExistsFn({ data: { orderId } }),
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
      let structuredAnswers: any = {};
      if (answer) {
        structuredAnswers.questionAnswer = answer;
      }
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
      setSuccessCredits(data.creditEarned);
      setTimeout(() => {
        navigate({ to: "/checkout", search: { table: qrToken, order: orderId, session: sessionId } });
      }, 3000);
    },
  });

  if (existsQuery.isLoading || orderQuery.isLoading || existsQuery.data?.exists) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  const lines = orderQuery.data?.lines || [];
  const hasSpicy = lines.some((l: any) => l.menu_item.dietary_tags?.includes("spicy") || l.menu_item.allergens?.includes("spicy"));
  const hasDessert = lines.some((l: any) => l.menu_item.category?.toLowerCase().includes("dessert"));

  let questionText = "Would you recommend this to a friend?";
  let options = ["Definitely", "Probably", "Not sure", "No"];

  if (hasSpicy) {
    questionText = "Was the spice level right?";
    options = ["Yes", "Just right", "Too mild", "Too spicy"];
  } else if (hasDessert) {
    questionText = "How was the sweetness?";
    options = ["Perfect", "Too sweet", "Not sweet enough"];
  }

  if (successCredits !== null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div className="flex flex-col items-center">
          <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-primary/20 text-primary">
            <Sparkles className="size-8" />
          </div>
          <h1 className="font-display text-2xl text-foreground">Thank you!</h1>
          <p className="mt-2 text-muted-foreground">Your feedback has been submitted.</p>
          {successCredits > 0 && (
            <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-4 text-center">
              <p className="text-lg font-medium text-primary">You earned ₹{successCredits} credits!</p>
              <p className="mt-1 text-sm text-muted-foreground">We've added this to your wallet.</p>
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
        <p className="mt-2 text-muted-foreground">Earn credits for your feedback.</p>

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
          <p className="mb-3 text-sm text-muted-foreground">Earn ₹20 extra for leaving a comment.</p>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tell us what you loved..."
            className="h-24 resize-none"
          />
        </div>

        <div className="mt-8 rounded-xl border border-border bg-card p-4 shadow-soft">
          <Label className="text-base text-foreground">{questionText}</Label>
          <p className="mb-4 mt-1 text-sm text-muted-foreground">Earn ₹5 extra for answering.</p>
          <RadioGroup value={answer} onValueChange={setAnswer}>
            {options.map((opt) => (
              <div key={opt} className="flex items-center space-x-2 py-2">
                <RadioGroupItem value={opt} id={opt} />
                <Label htmlFor={opt} className="cursor-pointer font-normal text-foreground">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

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

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Loader2, StopCircle, Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { parseVoiceOrderFn } from "@/lib/voice.functions";
import type { VoiceOrderResponse } from "@/lib/voice.server";

// Polyfill types for SpeechRecognition
interface SpeechRecognitionEvent {
  results: { [index: number]: { [index: number]: { transcript: string } } };
  resultIndex: number;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}
declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};
declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

export function VoiceOrder({
  qrToken,
  onAddToCart,
}: {
  qrToken: string;
  onAddToCart: (item: { menuItemId: string; qty: number; notes: string }) => Promise<void>;
}) {
  const [supported, setSupported] = useState(true);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const [showConfirm, setShowConfirm] = useState(false);
  const [parsedOrder, setParsedOrder] = useState<VoiceOrderResponse | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [clarificationInput, setClarificationInput] = useState("");

  const parseMutation = useMutation({
    mutationFn: (text: string) => parseVoiceOrderFn({ data: { qrToken, transcript: text } }),
    onSuccess: (data) => {
      setParsedOrder(data);
      setShowConfirm(true);
      setIsProcessing(false);
    },
    onError: () => {
      setErrorMsg("Voice ordering is slow right now. Try again or tap items from the menu.");
      setIsProcessing(false);
    },
  });

  useEffect(() => {
    const SpeechRec = window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      setSupported(false);
      return;
    }
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTrans = "";
      let interimTrans = "";
      for (let i = event.resultIndex; i < (event.results as any).length; ++i) {
        if ((event.results as any)[i].isFinal) {
          finalTrans += (event.results as any)[i][0].transcript;
        } else {
          interimTrans += (event.results as any)[i][0].transcript;
        }
      }
      const currentText = finalTrans || interimTrans;
      setTranscript(currentText);

      // Reset silence timer
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        stopRecording(currentText);
      }, 2000);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setErrorMsg("Voice ordering isn't available in this browser. Please tap items from the menu instead.");
      }
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  const stopRecording = useCallback((finalText: string) => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
    setRecording(false);
    
    const text = finalText.trim();
    if (!text) {
      setErrorMsg("We didn't catch that. Try again.");
      return;
    }
    
    setIsProcessing(true);
    parseMutation.mutate(text);
  }, [parseMutation]);

  const toggleRecording = () => {
    setErrorMsg(null);
    if (recording) {
      stopRecording(transcript);
    } else {
      setTranscript("");
      setRecording(true);
      try {
        recognitionRef.current?.start();
        // Hard cap of 10 seconds
        setTimeout(() => {
          if (recording) stopRecording(transcript);
        }, 10000);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleClarify = () => {
    if (!clarificationInput.trim()) return;
    setIsProcessing(true);
    // Append the clarification to the original transcript
    parseMutation.mutate(transcript + ". " + clarificationInput);
    setClarificationInput("");
  };

  const handleConfirmAll = async () => {
    if (!parsedOrder?.parsed_items) return;
    setIsProcessing(true);
    setShowConfirm(false);
    try {
      for (const item of parsedOrder.parsed_items) {
        if (item.quantity > 0) {
          await onAddToCart({
            menuItemId: item.menu_item_id,
            qty: Number(item.quantity) || 1,
            notes: item.customizations || "",
          });
        }
      }
      setParsedOrder(null);
      setTranscript("");
    } catch (error) {
      // If it throws ALLERGY_WARNING, onAddToCart will handle the modal (in table.qrToken)
      // Actually we just wait for it to finish.
    } finally {
      setIsProcessing(false);
    }
  };

  const updateItemQty = (id: string, delta: number) => {
    if (!parsedOrder) return;
    setParsedOrder({
      ...parsedOrder,
      parsed_items: parsedOrder.parsed_items.map(item =>
        item.menu_item_id === id ? { ...item, quantity: Math.max(0, (Number(item.quantity) || 1) + delta) } : item
      ),
    });
  };

  if (!supported) return null;

  const hasItems = parsedOrder?.parsed_items && parsedOrder.parsed_items.length > 0;
  const isNoMatch = !hasItems && !parsedOrder?.clarification_needed && showConfirm;

  return (
    <>
      <div className="fixed bottom-24 right-5 z-40 flex flex-col items-end gap-2">
        {errorMsg && (
          <div className="bg-destructive text-destructive-foreground text-xs p-2 rounded-lg shadow-lg max-w-[200px] text-right">
            {errorMsg}
          </div>
        )}
        {recording && (
          <div className="bg-primary text-primary-foreground text-xs p-2 rounded-full px-4 shadow-lg animate-pulse">
            Listening: {transcript}...
          </div>
        )}
        {isProcessing && !showConfirm && (
          <div className="bg-background border border-border text-foreground text-xs p-2 rounded-full px-4 shadow-lg flex items-center gap-2">
            <Loader2 className="size-4 animate-spin" /> Thinking...
          </div>
        )}
        
        <Button
          size="icon"
          className={`size-14 rounded-full shadow-lg transition-transform ${recording ? 'bg-destructive hover:bg-destructive/90 scale-110' : 'bg-primary hover:bg-primary/90'}`}
          onClick={toggleRecording}
        >
          {recording ? <StopCircle className="size-6" /> : <Mic className="size-6" />}
        </Button>
      </div>

      <Dialog open={showConfirm || isNoMatch} onOpenChange={open => {
        if (!open) {
          setShowConfirm(false);
          setParsedOrder(null);
        }
      }}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNoMatch ? "We couldn't find those items." : "Did we get this right?"}
            </DialogTitle>
          </DialogHeader>

          {isNoMatch ? (
            <p className="text-sm text-muted-foreground">
              Try tapping them from the menu instead.
            </p>
          ) : (
            <div className="space-y-4 py-4">
              {parsedOrder?.parsed_items.map((item) => item.quantity > 0 && (
                <div key={item.menu_item_id} className="flex items-center justify-between bg-card border rounded-lg p-3">
                  <div>
                    <p className="font-medium text-sm">{item.name}</p>
                    {item.customizations && (
                      <p className="text-xs text-muted-foreground">{item.customizations}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 bg-secondary rounded-full p-1">
                    <button
                      className="size-7 rounded-full bg-background grid place-items-center"
                      onClick={() => updateItemQty(item.menu_item_id, -1)}
                    >
                      {item.quantity === 1 ? <Trash2 className="size-3.5 text-destructive" /> : <Minus className="size-3.5" />}
                    </button>
                    <span className="text-sm font-medium w-4 text-center">{item.quantity}</span>
                    <button
                      className="size-7 rounded-full bg-background grid place-items-center"
                      onClick={() => updateItemQty(item.menu_item_id, 1)}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {parsedOrder?.clarification_needed && (
                <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
                  <p className="text-sm font-medium text-primary mb-3">
                    {parsedOrder.clarification_needed}
                  </p>
                  <div className="flex gap-2">
                    <Input 
                      value={clarificationInput} 
                      onChange={e => setClarificationInput(e.target.value)}
                      placeholder="Type your answer..."
                      className="bg-background h-9 text-sm"
                      onKeyDown={e => e.key === "Enter" && handleClarify()}
                    />
                    <Button size="sm" onClick={handleClarify} disabled={!clarificationInput.trim() || isProcessing}>
                      {isProcessing ? <Loader2 className="size-4 animate-spin" /> : "Answer"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex-row sm:justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowConfirm(false)} className="w-full sm:w-auto">
              Start over
            </Button>
            {!isNoMatch && (
              <Button onClick={handleConfirmAll} disabled={isProcessing || !hasItems} className="w-full sm:w-auto">
                {isProcessing ? <Loader2 className="size-4 animate-spin" /> : "Add to cart"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

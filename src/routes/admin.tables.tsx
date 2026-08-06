import { createFileRoute } from '@tanstack/react-router'

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import QRCode from "qrcode";
import jsPDF from "jspdf";
import { fetchAdminTablesFn, toggleTableFn, createTableFn } from "@/lib/tables.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/tables")({
  component: AdminTablesPage,
});

function AdminTablesPage() {
  const queryClient = useQueryClient();
  const { restaurant } = Route.useRouteContext();
  
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [seatCount, setSeatCount] = useState(4);
  const qrRefs = useRef<Record<string, HTMLCanvasElement | null>>({});

  const { data: tables = [] } = useQuery({
    queryKey: ["admin-tables", restaurant.id],
    queryFn: () => fetchAdminTablesFn({ data: { restaurantId: restaurant.id } }),
  });

  const toggleMutation = useMutation({
    mutationFn: (opts: { tableId: string, is_active: boolean }) => toggleTableFn({ data: opts }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-tables", restaurant.id] })
  });

  const createMutation = useMutation({
    mutationFn: (opts: { label: string, seat_count: number }) => 
      createTableFn({ data: { restaurantId: restaurant.id, ...opts } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-tables", restaurant.id] });
      setShowForm(false);
      setLabel("");
      setSeatCount(4);
    }
  });

  const getTableUrl = (qrToken: string) => {
    // In dev, use localhost or the current window origin.
    // Ensure we capture the full path correctly.
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8081';
    return `${baseUrl}/table/${qrToken}`;
  };

  const renderQRCode = (canvas: HTMLCanvasElement | null, text: string) => {
    if (canvas) {
      QRCode.toCanvas(canvas, text, { width: 128, margin: 1 }, (error) => {
        if (error) console.error(error);
      });
    }
  };

  const downloadSingleQR = async (table: any) => {
    const url = getTableUrl(table.qr_token);
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 2 });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${restaurant.name.replace(/\\s+/g, "_")}_${table.label.replace(/\\s+/g, "_")}_QR.png`;
      a.click();
    } catch (err) {
      console.error(err);
    }
  };

  const downloadAllQR = async () => {
    if (!tables.length) return;
    
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4"
    });

    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const url = getTableUrl(table.qr_token);
      try {
        const dataUrl = await QRCode.toDataURL(url, { width: 512, margin: 0 });
        
        if (i > 0) pdf.addPage();
        
        pdf.setFontSize(24);
        pdf.text(restaurant.name, 105, 40, { align: "center" });
        
        pdf.setFontSize(16);
        pdf.text(`Scan to order at ${table.label}`, 105, 55, { align: "center" });
        
        // Add QR code image
        pdf.addImage(dataUrl, 'PNG', 55, 70, 100, 100);
        
        pdf.setFontSize(12);
        pdf.text("Powered by TableMind", 105, 190, { align: "center" });
      } catch (err) {
        console.error("Error generating QR for table", table.label, err);
      }
    }
    
    pdf.save(`${restaurant.name.replace(/\\s+/g, "_")}_All_QRs.pdf`);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Tables & QR Codes</h1>
        <div className="flex gap-4">
          <Button variant="outline" onClick={downloadAllQR} disabled={tables.length === 0}>
            Download All PDF
          </Button>
          <Button onClick={() => setShowForm(!showForm)}>
            {showForm ? "Cancel" : "Add Table"}
          </Button>
        </div>
      </div>

      {showForm && (
        <div className="bg-card border border-border p-6 rounded-xl mb-8 space-y-4 max-w-md">
          <h2 className="text-lg font-semibold">New Table</h2>
          <div>
            <Label>Table Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Table 12, Patio 3" />
          </div>
          <div>
            <Label>Seat Count</Label>
            <Input type="number" min={1} value={seatCount} onChange={e => setSeatCount(Number(e.target.value))} />
          </div>
          <Button 
            onClick={() => createMutation.mutate({ label, seat_count: seatCount })}
            disabled={!label || createMutation.isPending}
          >
            Create
          </Button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tables.map((t: any) => {
          const url = getTableUrl(t.qr_token);
          return (
            <div key={t.id} className={`border border-border bg-card p-5 rounded-xl flex flex-col items-center text-center ${!t.is_active ? "opacity-60" : ""}`}>
              <div className="w-full flex justify-between items-start mb-4">
                <div className="text-left">
                  <h3 className="font-semibold text-lg">{t.label}</h3>
                  <p className="text-xs text-muted-foreground">{t.seat_count} seats</p>
                </div>
                <Switch 
                  checked={t.is_active} 
                  onCheckedChange={(c) => toggleMutation.mutate({ tableId: t.id, is_active: c })} 
                />
              </div>
              
              <div className="bg-white p-2 rounded-lg mb-4">
                <canvas 
                  ref={el => {
                    qrRefs.current[t.id] = el;
                    renderQRCode(el, url);
                  }}
                />
              </div>
              
              <p className="text-xs text-muted-foreground mb-4 break-all px-2">
                {url}
              </p>
              
              <Button variant="secondary" className="w-full mt-auto" onClick={() => downloadSingleQR(t)}>
                Download QR
              </Button>
            </div>
          );
        })}
        {tables.length === 0 && !showForm && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            No tables yet. Click "Add Table" to get started.
          </div>
        )}
      </div>
    </div>
  );
}

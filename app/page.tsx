"use client";

import type React from "react";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Download,
  Upload,
  Plus,
  Edit3,
  Move,
  FileDown,
} from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { ConfigureData } from "@/components/ui/configure-data";

interface TextArea {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  variableName: string;
  value: string;
  type: "text" | "image" | "date";
}

interface Template {
  name: string;
  textAreas: TextArea[];
  backgroundPdfs?: string[];
  pdfPages?: number;
  currentPage?: number;
}

export default function PDFTemplateEditor() {
  const [template, setTemplate] = useState<Template>({
    name: "Template Baru",
    textAreas: [],
    backgroundPdfs: [],
    currentPage: 1,
  });
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [isDraggingArea, setIsDraggingArea] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [selectedArea, setSelectedArea] = useState<TextArea | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<"text" | "image" | "date">(
    "text"
  );
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [activeTab, setActiveTab] = useState("create");
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  // Load PDF.js with proper error handling
  useEffect(() => {
    const loadPdfJs = async () => {
      try {
        if (typeof window !== "undefined") {
          // Dynamic import with proper error handling
          const pdfjsLib = await import("pdfjs-dist");

          // Set worker source with fallback
          if (pdfjsLib.GlobalWorkerOptions) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
          }

          setPdfLoaded(true);
          console.log("PDF.js loaded successfully");
        }
      } catch (error) {
        console.error("Error loading PDF.js:", error);
        setPdfLoaded(false);
      }
    };

    loadPdfJs();
  }, []);

  // Handle dragging with window-level event listeners for better experience
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingArea || !canvasRef.current) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const newX = x - dragOffset.x;
      const newY = y - dragOffset.y;

      setTemplate((prev) => ({
        ...prev,
        textAreas: prev.textAreas.map((area) =>
          area.id === isDraggingArea
            ? {
                ...area,
                x: Math.max(0, Math.min(newX, canvas.width - area.width)),
                y: Math.max(0, Math.min(newY, canvas.height - area.height)),
              }
            : area
        ),
      }));
    };

    const handleMouseUp = () => {
      setIsDraggingArea(null);
    };

    if (isDraggingArea) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingArea, dragOffset, setTemplate]);

  // Handle resizing with window-level event listeners
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !canvasRef.current || !selectedArea) return;

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;

      setTemplate((prev) => ({
        ...prev,
        textAreas: prev.textAreas.map((area) => {
          if (area.id === selectedArea.id) {
            const newArea = { ...area };
            if (resizeHandle?.includes("e")) {
              newArea.width = Math.max(20, mouseX - newArea.x);
            }
            if (resizeHandle?.includes("s")) {
              newArea.height = Math.max(20, mouseY - newArea.y);
            }
            if (resizeHandle?.includes("w")) {
              const newWidth = newArea.x + newArea.width - mouseX;
              if (newWidth > 20) {
                newArea.width = newWidth;
                newArea.x = mouseX;
              }
            }
            if (resizeHandle?.includes("n")) {
              const newHeight = newArea.y + newArea.height - mouseY;
              if (newHeight > 20) {
                newArea.height = newHeight;
                newArea.y = mouseY;
              }
            }
            return newArea;
          }
          return area;
        }),
      }));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, resizeHandle, selectedArea, setTemplate]);

  // Handle mouse down untuk mulai membuat area atau drag area existing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isResizing) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      // Check if clicking on existing area
      const clickedArea = template.textAreas.find(
        (area) =>
          x >= area.x &&
          x <= area.x + area.width &&
          y >= area.y &&
          y <= area.y + area.height
      );

      if (clickedArea && !isCreatingArea) {
        // Start dragging existing area
        setIsDraggingArea(clickedArea.id);
        setDragOffset({
          x: x - clickedArea.x,
          y: y - clickedArea.y,
        });
        setSelectedArea(clickedArea);
        return;
      }

      if (isCreatingArea) {
        // Start creating new area
        setDragStart({ x, y });
      } else if (!clickedArea) {
        setSelectedArea(null);
      }
    },
    [isCreatingArea, template.textAreas, isResizing]
  );

  // Handle mouse move untuk drag area atau preview area baru
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Dragging is handled by a useEffect with window event listeners.
      // This function is now only for creating areas.
    },
    []
  );

  // Handle mouse up untuk selesai membuat area atau drag
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      // Dragging is handled by a useEffect with window event listeners.
      if (!isCreatingArea || !dragStart) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;
      const x = (e.clientX - rect.left) * scaleX;
      const y = (e.clientY - rect.top) * scaleY;

      const width = Math.abs(x - dragStart.x);
      const height = Math.abs(y - dragStart.y);

      if (width > 10 && height > 10) {
        const newArea: TextArea = {
          id: Date.now().toString(),
          x: Math.min(dragStart.x, x),
          y: Math.min(dragStart.y, y),
          width,
          height,
          variableName: `variable_${template.textAreas.length + 1}`,
          value: "",
          type: creatingType,
        };

        setTemplate((prev) => ({
          ...prev,
          textAreas: [...prev.textAreas, newArea],
        }));
      }

      setDragStart(null);
      setIsCreatingArea(false);
    },
    [
      isCreatingArea,
      dragStart,
      template.textAreas.length,
      isDraggingArea,
      creatingType,
    ]
  );

  // Upload PDF file with better error handling
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    if (!pdfLoaded) {
      alert("PDF library is still loading. Please try again in a moment.");
      return;
    }

    try {
      // Dynamic import inside the function to ensure it's loaded
      const pdfjsLib = await import("pdfjs-dist");

      // Ensure worker is configured
      if (
        pdfjsLib.GlobalWorkerOptions &&
        !pdfjsLib.GlobalWorkerOptions.workerSrc
      ) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      const backgroundPdfs: string[] = [];

      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 }); // Higher scale for better quality

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext("2d");

        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          await page.render({
            canvasContext: context,
            viewport: viewport,
          }).promise;
          backgroundPdfs.push(canvas.toDataURL("image/png", 1.0));
        }
      }

      setTemplate((prev) => ({
        ...prev,
        backgroundPdfs,
        pdfPages: numPages,
        currentPage: 1,
      }));

      console.log(`PDF with ${numPages} pages loaded successfully`);
    } catch (error) {
      console.error("Error loading PDF:", error);
      alert(
        `Error loading PDF file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Fallback PDF upload using FileReader (for when PDF.js fails)
  const handleFallbackPdfUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      alert("Please select a PDF file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (result) {
        // For fallback, we'll just show a placeholder
        setTemplate((prev) => ({
          ...prev,
          backgroundPdf:
            "/placeholder.svg?height=800&width=600&text=PDF+Background",
          pdfPages: 1,
          currentPage: 1,
        }));
        console.log("PDF uploaded (fallback mode)");
      }
    };
    reader.readAsDataURL(file);
  };

  // Update variable value
  const updateVariableValue = (id: string, value: string) => {
    setTemplate((prev) => ({
      ...prev,
      textAreas: prev.textAreas.map((area) =>
        area.id === id ? { ...area, value } : area
      ),
    }));
  };

  // Update variable name
  const updateVariableName = (id: string, variableName: string) => {
    setTemplate((prev) => ({
      ...prev,
      textAreas: prev.textAreas.map((area) =>
        area.id === id ? { ...area, variableName } : area
      ),
    }));
  };

  // Delete text area
  const deleteTextArea = (id: string) => {
    setTemplate((prev) => ({
      ...prev,
      textAreas: prev.textAreas.filter((area) => area.id !== id),
    }));
    if (selectedArea?.id === id) {
      setSelectedArea(null);
    }
  };

  // Export template
  const exportTemplate = () => {
    const dataStr = JSON.stringify(template, null, 2);
    const dataUri =
      "data:application/json;charset=utf-8," + encodeURIComponent(dataStr);

    const exportFileDefaultName = `${template.name.replace(/\s+/g, "_")}.json`;

    const linkElement = document.createElement("a");
    linkElement.setAttribute("href", dataUri);
    linkElement.setAttribute("download", exportFileDefaultName);
    linkElement.click();
  };

  // Export as PDF
  const exportAsPdf = async () => {
    if (!previewRef.current) {
      alert("Preview area not found.");
      return;
    }

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2, // Higher scale for better quality
        useCORS: true,
        logging: true,
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`${template.name.replace(/\s+/g, "_")}.pdf`);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert(
        `Could not export to PDF: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  // Import template
  const handleTemplateImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const result = event.target?.result;
        if (typeof result === "string") {
          const importedTemplate = JSON.parse(result);
          setTemplate(importedTemplate);
        }
      } catch (error) {
        console.error("Error parsing template file:", error);
        alert("Invalid template file.");
      }
    };
    reader.readAsText(file);
  };

  const handleSelectProject = (project: any) => {
    const newTextAreas = template.textAreas.map((area) => {
      if (project.hasOwnProperty(area.variableName)) {
        return { ...area, value: project[area.variableName] };
      }
      return area;
    });
    setTemplate((prev) => ({ ...prev, textAreas: newTextAreas }));
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Hidden canvas for PDF rendering */}
      <canvas ref={pdfCanvasRef} style={{ display: "none" }} />

      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Editor Template PDF
          </h1>
          <p className="text-gray-600">
            Buat template dengan area variabel yang dapat diisi dan dipindahkan
          </p>
          {!pdfLoaded && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
              PDF library sedang dimuat... Beberapa fitur mungkin tidak
              tersedia.
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Buat Template</TabsTrigger>
            <TabsTrigger value="fill">Isi Template</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Edit3 className="h-5 w-5" />
                  Pengaturan Template
                </CardTitle>
                <CardDescription>
                  Upload file PDF dan buat area teks dengan mengklik dan drag.
                  Area dapat dipindahkan setelah dibuat.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4 items-end">
                  <div className="flex-1">
                    <Label htmlFor="template-name">Nama Template</Label>
                    <Input
                      id="template-name"
                      value={template.name}
                      onChange={(e) =>
                        setTemplate((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Masukkan nama template"
                    />
                  </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Upload PDF
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={
                      pdfLoaded ? handlePdfUpload : handleFallbackPdfUpload
                    }
                    className="hidden"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setIsCreatingArea(true);
                      setCreatingType("text");
                    }}
                    disabled={isCreatingArea}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingArea
                      ? "Klik dan drag untuk membuat area"
                      : "Tambah Area Teks"}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsCreatingArea(true);
                      setCreatingType("date");
                    }}
                    disabled={isCreatingArea}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingArea
                      ? "Klik dan drag untuk membuat area"
                      : "Tambah Area Tanggal"}
                  </Button>
                  <Button
                    onClick={() => {
                      setIsCreatingArea(true);
                      setCreatingType("image");
                    }}
                    disabled={isCreatingArea}
                    className="flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {isCreatingArea
                      ? "Klik dan drag untuk membuat area"
                      : "Tambah Area Gambar"}
                  </Button>
                  <Button
                    onClick={exportTemplate}
                    variant="outline"
                    className="flex items-center gap-2 bg-transparent"
                  >
                    <Download className="h-4 w-4" />
                    Export Template
                  </Button>
                  <Button
                    onClick={() =>
                      document.getElementById("import-template")?.click()
                    }
                    variant="outline"
                    className="flex items-center gap-2 bg-transparent"
                  >
                    <Upload className="h-4 w-4" />
                    Import Template
                  </Button>
                  <input
                    id="import-template"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleTemplateImport}
                  />
                  <ConfigureData onSelectProject={handleSelectProject} />
                </div>

                {isCreatingArea && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Mode Buat Area:</strong> Klik dan drag pada canvas
                      untuk membuat area teks baru.
                    </p>
                  </div>
                )}

                {!isCreatingArea && template.textAreas.length > 0 && (
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-sm text-green-700 flex items-center gap-2">
                      <Move className="h-4 w-4" />
                      <strong>Mode Edit:</strong> Klik dan drag area teks untuk
                      memindahkannya.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Canvas Template</CardTitle>
                    <CardDescription>
                      {isCreatingArea
                        ? "Klik dan drag untuk membuat area teks baru"
                        : template.textAreas.length > 0
                        ? "Klik dan drag area teks untuk memindahkannya"
                        : 'Klik "Tambah Area Teks" untuk mulai membuat area'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="relative border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
                      <canvas
                        ref={canvasRef}
                        width={600}
                        height={800}
                        className={`w-full h-auto bg-white ${
                          isCreatingArea
                            ? "cursor-crosshair"
                            : isDraggingArea
                            ? "cursor-grabbing"
                            : "cursor-grab"
                        }`}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        style={{
                          backgroundImage:
                            template.backgroundPdfs &&
                            template.backgroundPdfs.length > 0
                              ? `url(${
                                  template.backgroundPdfs[
                                    (template.currentPage ?? 1) - 1
                                  ]
                                })`
                              : "none",
                          backgroundSize: "contain",
                          backgroundRepeat: "no-repeat",
                          backgroundPosition: "center",
                        }}
                      />

                      {/* Render text areas */}
                      {template.textAreas.map((area) => (
                        <div
                          key={area.id}
                          className={`absolute border-2 ${
                            selectedArea?.id === area.id
                              ? "border-blue-600"
                              : "border-blue-400"
                          } ${
                            isDraggingArea === area.id
                              ? "border-blue-600 shadow-lg"
                              : ""
                          } flex items-center justify-center text-xs font-medium text-blue-700 transition-all duration-200 hover:border-blue-600 pointer-events-none`}
                          style={{
                            left: `${(area.x / 600) * 100}%`,
                            top: `${(area.y / 800) * 100}%`,
                            width: `${(area.width / 600) * 100}%`,
                            height: `${(area.height / 800) * 100}%`,
                            backgroundColor: "transparent",
                            cursor: isCreatingArea ? "crosshair" : "grab",
                          }}
                        >
                          <div className="pointer-events-none w-full h-full flex items-center justify-center">
                            <span className="bg-white bg-opacity-80 px-1 py-0.5 rounded text-center">
                              {area.variableName}
                            </span>
                          </div>

                          {selectedArea?.id === area.id && !isCreatingArea && (
                            <>
                              <div
                                className="absolute -right-1.5 -top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white cursor-nesw-resize pointer-events-auto"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setIsResizing(true);
                                  setResizeHandle("ne");
                                }}
                              />
                              <div
                                className="absolute -right-1.5 -bottom-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white cursor-nwse-resize pointer-events-auto"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setIsResizing(true);
                                  setResizeHandle("se");
                                }}
                              />
                              <div
                                className="absolute -left-1.5 -bottom-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white cursor-nesw-resize pointer-events-auto"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setIsResizing(true);
                                  setResizeHandle("sw");
                                }}
                              />
                              <div
                                className="absolute -left-1.5 -top-1.5 w-3 h-3 rounded-full bg-blue-600 border-2 border-white cursor-nwse-resize pointer-events-auto"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setIsResizing(true);
                                  setResizeHandle("nw");
                                }}
                              />
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div>
                <Card>
                  <CardHeader>
                    <CardTitle>Area Variabel</CardTitle>
                    <CardDescription>
                      Kelola area teks yang telah dibuat
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {template.pdfPages && template.pdfPages > 1 && (
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setTemplate((prev) => ({
                              ...prev,
                              currentPage: Math.max(
                                1,
                                (prev.currentPage ?? 1) - 1
                              ),
                            }))
                          }
                          disabled={(template.currentPage ?? 1) === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm font-medium">
                          Page {template.currentPage} of {template.pdfPages}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setTemplate((prev) => ({
                              ...prev,
                              currentPage: Math.min(
                                template.pdfPages ?? 1,
                                (prev.currentPage ?? 1) + 1
                              ),
                            }))
                          }
                          disabled={
                            (template.currentPage ?? 1) === template.pdfPages
                          }
                        >
                          Next
                        </Button>
                      </div>
                    )}
                    <div className="space-y-3">
                      {template.textAreas.length === 0 ? (
                        <p className="text-gray-500 text-sm">
                          Belum ada area teks yang dibuat
                        </p>
                      ) : (
                        template.textAreas.map((area) => (
                          <div
                            key={area.id}
                            className={`p-3 border rounded-lg space-y-2 transition-all duration-200 ${
                              selectedArea?.id === area.id
                                ? "border-blue-500 bg-blue-50"
                                : "border-gray-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">{area.type}</Badge>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setSelectedArea(area)}
                                  className="h-6 w-6 p-0"
                                >
                                  <Move className="h-3 w-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => deleteTextArea(area.id)}
                                  className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <Input
                              value={area.variableName}
                              onChange={(e) =>
                                updateVariableName(area.id, e.target.value)
                              }
                              placeholder="Nama variabel"
                              className="text-sm"
                            />
                            <div className="text-xs text-gray-500">
                              Posisi: ({Math.round(area.x)},{" "}
                              {Math.round(area.y)})
                              <br />
                              Ukuran: {Math.round(area.width)} ×{" "}
                              {Math.round(area.height)}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="fill" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Isi Template: {template.name}</CardTitle>
                <CardDescription>
                  Masukkan nilai untuk setiap variabel yang telah dibuat
                </CardDescription>
              </CardHeader>
              <CardContent>
                {template.textAreas.length === 0 ? (
                  <p className="text-gray-500">
                    Tidak ada variabel untuk diisi. Buat template terlebih
                    dahulu.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {template.textAreas.map((area) => (
                      <div key={area.id} className="space-y-2">
                        <Label
                          htmlFor={area.id}
                          className="flex items-center gap-2"
                        >
                          {area.variableName}
                          <Badge variant="outline" className="text-xs">
                            {area.type}
                          </Badge>
                        </Label>
                        {area.type === "text" ? (
                          <Textarea
                            id={area.id}
                            value={area.value}
                            onChange={(e) =>
                              updateVariableValue(area.id, e.target.value)
                            }
                            placeholder={`Masukkan nilai untuk ${area.variableName}`}
                            rows={3}
                          />
                        ) : area.type === "date" ? (
                          <Input
                            id={area.id}
                            type="date"
                            value={area.value}
                            onChange={(e) =>
                              updateVariableValue(area.id, e.target.value)
                            }
                          />
                        ) : (
                          <Input
                            id={area.id}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (event) => {
                                  updateVariableValue(
                                    area.id,
                                    event.target?.result as string
                                  );
                                };
                                reader.readAsDataURL(file);
                              }
                            }}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {template.textAreas.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Preview Template</CardTitle>
                    <CardDescription>
                      Lihat hasil template dengan nilai yang telah diisi
                    </CardDescription>
                  </div>
                  <Button
                    onClick={exportAsPdf}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <FileDown className="h-4 w-4" />
                    Export as PDF
                  </Button>
                </CardHeader>
                <CardContent>
                  <div
                    ref={previewRef}
                    className="relative border rounded-lg overflow-hidden bg-white"
                  >
                    <div
                      className="w-full relative"
                      style={{
                        aspectRatio: "600 / 800",
                        backgroundImage:
                          template.backgroundPdfs &&
                          template.backgroundPdfs.length > 0
                            ? `url(${
                                template.backgroundPdfs[
                                  (template.currentPage ?? 1) - 1
                                ]
                              })`
                            : "none",
                        backgroundSize: "contain",
                        backgroundRepeat: "no-repeat",
                        backgroundPosition: "center",
                      }}
                    >
                      {template.textAreas.map((area) => (
                        <div
                          key={area.id}
                          className="absolute flex items-center justify-center text-sm font-medium overflow-hidden"
                          style={{
                            left: `${(area.x / 600) * 100}%`,
                            top: `${(area.y / 800) * 100}%`,
                            width: `${(area.width / 600) * 100}%`,
                            height: `${(area.height / 800) * 100}%`,
                            backgroundColor: "transparent",
                          }}
                        >
                          {area.type === "text" || area.type === "date" ? (
                            <div className="w-full h-full p-1 text-center flex items-center justify-center text-black">
                              {area.value || area.variableName}
                            </div>
                          ) : area.value ? (
                            <img
                              src={area.value || "/placeholder.svg"}
                              alt={area.variableName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 bg-opacity-50 flex items-center justify-center text-gray-500 text-xs">
                              {area.variableName}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

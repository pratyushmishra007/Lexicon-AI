"use client";

import { useState } from "react";
import { Upload, FileText, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import Chat from "@/components/Chat";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "application/pdf") {
        setStatus("error");
        setErrorMessage("Please upload a valid PDF file.");
        return;
      }
      setFile(selectedFile);
      setStatus("idle");
      setErrorMessage("");
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setStatus("uploading");
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorMessage = "Failed to process document";
        try {
          const text = await response.text();
          try {
            const errorData = JSON.parse(text);
            errorMessage = errorData.error || errorMessage;
          } catch (e) {
            errorMessage = `Server Error (${response.status}): ` + text.slice(0, 100);
          }
        } catch (e) {
          // fallback if reading text fails
        }
        throw new Error(errorMessage);
      }

      setStatus("success");
      setFile(null);
    } catch (err: any) {
      console.error("Upload error:", err);
      setStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred.");
    } finally {
      setIsUploading(false);
    }
  };

  if (status === "success") {
    return (
      <div className="fixed inset-0 bg-[#0a0a0a] text-neutral-50 flex p-4 md:p-8 animate-in fade-in zoom-in-95 duration-500 z-50">
        <div className="w-full max-w-5xl h-full mx-auto relative z-10">
          <Chat />
        </div>
        {/* Background Mesh Gradients */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-50 flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Background Mesh Gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-emerald-900/20 blur-[120px] rounded-full pointer-events-none" />

      <div className="w-full max-w-3xl space-y-8 z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out">
        
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center space-x-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-neutral-300 uppercase tracking-wider">Lexicon AI</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight">
            Ask your documents
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              anything.
            </span>
          </h1>
          <p className="text-neutral-400 text-lg md:text-xl max-w-xl mx-auto font-light">
            Upload your resume, research papers, or docs. Our AI reads them instantly and answers intelligently.
          </p>
        </div>

        {/* Upload Card */}
        <div className="bg-neutral-900/40 backdrop-blur-xl border border-white/10 rounded-[2rem] p-8 shadow-2xl transition-all duration-500 hover:border-white/20 hover:shadow-emerald-500/10">
          
          <div 
            className="border-2 border-dashed border-white/10 rounded-[1.5rem] p-12 flex flex-col items-center justify-center text-center space-y-5 hover:bg-white/[0.02] hover:border-emerald-500/50 transition-all cursor-pointer relative group"
          >
            <input 
              type="file" 
              accept=".pdf"
              onChange={handleFileChange}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            
            <div className="p-5 bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-full shadow-inner group-hover:scale-110 transition-transform duration-300">
              <Upload className="w-8 h-8 text-emerald-400" />
            </div>
            
            <div>
              <p className="text-xl font-medium text-neutral-200">
                Click to upload or drag & drop
              </p>
              <p className="text-sm text-neutral-500 mt-2 font-mono">
                PDF format (Max 10MB)
              </p>
            </div>
          </div>

          {/* File Selected State */}
          {file && (
            <div className="mt-6 flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-2xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center space-x-4 overflow-hidden">
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <FileText className="w-6 h-6 text-blue-400" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-neutral-200 truncate max-w-[200px] md:max-w-[300px]">
                    {file.name}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
              </div>
              <button 
                onClick={handleUpload}
                disabled={isUploading}
                className="ml-4 px-6 py-3 bg-white text-black hover:bg-neutral-200 text-sm font-bold rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg shadow-white/10"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Indexing...</span>
                  </>
                ) : (
                  <span>Start Engine</span>
                )}
              </button>
            </div>
          )}

          {/* Error State */}
          {status === "error" && (
            <div className="mt-6 flex items-center space-x-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 animate-in fade-in shake duration-300">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{errorMessage}</p>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}

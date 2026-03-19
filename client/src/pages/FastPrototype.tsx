/**
 * Fast Prototyping from Product Picture
 * 
 * Customer-facing flow:
 * 1. Upload 1-3 product images (or paste URL)
 * 2. AI extracts product type, key features, what's still needed
 * 3. Customer fills in EAU / SOP / Region / design intent
 * 4. Creates a prototype request ticket
 * 5. Confirmation message
 */
import { useState, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Camera,
  Upload,
  Sparkles,
  CheckCircle2,
  Loader2,
  X,
  Link as LinkIcon,
  Package,
  Cpu,
  HelpCircle,
  Send,
  ArrowRight,
  ArrowLeft,
  FileText,
} from "lucide-react";

type Step = "upload" | "analyzing" | "review" | "details" | "submitted";

interface ImageFile {
  file: File;
  preview: string;
  base64: string;
}

interface Extraction {
  productTypeGuess: string;
  keyFeatureGuess: string[];
  whatWeStillNeed: string[];
}

export default function FastPrototype() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step state
  const [step, setStep] = useState<Step>("upload");

  // Upload state
  const [images, setImages] = useState<ImageFile[]>([]);
  const [productUrl, setProductUrl] = useState("");

  // Extraction state
  const [extraction, setExtraction] = useState<Extraction | null>(null);
  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // Customer details state
  const [annualUnits, setAnnualUnits] = useState("");
  const [expectedSop, setExpectedSop] = useState("");
  const [region, setRegion] = useState<"EU" | "US" | "APAC" | "Other" | "">("");
  const [designIntent, setDesignIntent] = useState<"equivalent" | "modified" | "">("");
  const [hasBom, setHasBom] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCompany, setCustomerCompany] = useState("");

  // Submitted state
  const [requestId, setRequestId] = useState<number | null>(null);

  // Mutations
  const uploadMutation = trpc.prototype.uploadImages.useMutation();
  const analyzeMutation = trpc.prototype.analyzeImages.useMutation();
  const createMutation = trpc.prototype.createRequest.useMutation();

  // Handle file selection
  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (images.length + files.length > 3) {
      toast.error("Maximum 3 images — you can upload up to 3 product images.");
      return;
    }

    const newImages: ImageFile[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10MB limit.`);
        continue;
      }
      const base64 = await fileToBase64(file);
      const preview = URL.createObjectURL(file);
      newImages.push({ file, preview, base64 });
    }

    setImages(prev => [...prev, ...newImages].slice(0, 3));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [images, toast]);

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  // Handle analyze
  const handleAnalyze = async () => {
    if (images.length === 0) {
      toast.error("Please upload at least one product image.");
      return;
    }

    setStep("analyzing");

    try {
      // Step 1: Upload images to S3
      const uploadResult = await uploadMutation.mutateAsync({
        images: images.map(img => ({
          base64: img.base64,
          filename: img.file.name,
          mimeType: img.file.type,
        })),
      });
      setImageUrls(uploadResult.imageUrls);

      // Step 2: Analyze with LLM vision
      const analysisResult = await analyzeMutation.mutateAsync({
        imageUrls: uploadResult.imageUrls,
        productUrl: productUrl || undefined,
      });
      setExtraction(analysisResult);
      setStep("review");
    } catch (err: any) {
      toast.error(err.message || "Analysis failed — please try again.");
      setStep("upload");
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!extraction) return;

    try {
      const result = await createMutation.mutateAsync({
        imageUrls,
        productUrl: productUrl || undefined,
        productTypeGuess: extraction.productTypeGuess,
        keyFeatureGuess: extraction.keyFeatureGuess,
        whatWeStillNeed: extraction.whatWeStillNeed,
        annualUnits: annualUnits || undefined,
        expectedSop: expectedSop || undefined,
        region: region as any || undefined,
        designIntent: designIntent as any || undefined,
        hasBom,
        customerNotes: customerNotes || undefined,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerCompany: customerCompany || undefined,
      });
      setRequestId(result.id);
      setStep("submitted");
    } catch (err: any) {
      toast.error(err.message || "Submission failed — please try again.");
    }
  };

  const resetForm = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    setProductUrl("");
    setExtraction(null);
    setImageUrls([]);
    setAnnualUnits("");
    setExpectedSop("");
    setRegion("");
    setDesignIntent("");
    setHasBom(false);
    setCustomerNotes("");
    setCustomerName("");
    setCustomerEmail("");
    setCustomerCompany("");
    setRequestId(null);
    setStep("upload");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Fast Prototyping</h1>
              <p className="text-sm text-slate-400">Upload a product picture — get a prototype quote started</p>
            </div>
          </div>
          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-4">
            {[
              { key: "upload", label: "Upload", icon: Upload },
              { key: "review", label: "AI Analysis", icon: Sparkles },
              { key: "details", label: "Your Details", icon: FileText },
              { key: "submitted", label: "Submitted", icon: CheckCircle2 },
            ].map((s, i) => {
              const isActive = step === s.key || (step === "analyzing" && s.key === "review");
              const isPast = ["upload", "analyzing", "review", "details", "submitted"].indexOf(step) >
                ["upload", "analyzing", "review", "details", "submitted"].indexOf(s.key);
              const Icon = s.icon;
              return (
                <div key={s.key} className="flex items-center gap-2">
                  {i > 0 && <div className={`w-8 h-px ${isPast ? "bg-indigo-500" : "bg-white/20"}`} />}
                  <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive ? "bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/50" :
                    isPast ? "bg-indigo-500/10 text-indigo-400" : "text-slate-500"
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                    {s.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* ─── STEP 1: UPLOAD ─── */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* Drop zone */}
            <Card className="bg-white/5 border-white/10 border-dashed border-2 hover:border-indigo-500/50 transition-colors">
              <CardContent className="py-12">
                <div
                  className="flex flex-col items-center justify-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-4">
                    <Camera className="w-8 h-8 text-indigo-400" />
                  </div>
                  <p className="text-lg font-semibold text-white mb-1">
                    Drop product images here
                  </p>
                  <p className="text-sm text-slate-400 mb-4">
                    or click to browse — up to 3 images, max 10MB each
                  </p>
                  <Button variant="outline" className="border-indigo-500/50 text-indigo-300 hover:bg-indigo-500/10">
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Files
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Image previews */}
            {images.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {images.map((img, i) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10">
                    <img src={img.preview} alt={`Product ${i + 1}`} className="w-full h-48 object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 py-2">
                      <p className="text-xs text-white truncate">{img.file.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Optional URL */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-6">
                <Label className="text-slate-300 flex items-center gap-2 mb-2">
                  <LinkIcon className="w-4 h-4" />
                  Product URL (optional)
                </Label>
                <Input
                  placeholder="e.g. https://super-b.com/epsilon-12v150ah"
                  value={productUrl}
                  onChange={e => setProductUrl(e.target.value)}
                  className="bg-white/5 border-white/10 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500 mt-1">Paste a link to the competing product for better analysis</p>
              </CardContent>
            </Card>

            {/* Analyze button */}
            <Button
              size="lg"
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold text-base py-6"
              disabled={images.length === 0}
              onClick={handleAnalyze}
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Analyze Product ({images.length} image{images.length !== 1 ? "s" : ""})
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </div>
        )}

        {/* ─── STEP 2: ANALYZING ─── */}
        {step === "analyzing" && (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-16 flex flex-col items-center justify-center">
              <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 animate-pulse">
                <Sparkles className="w-10 h-10 text-indigo-400" />
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">Analyzing your product images...</h2>
              <p className="text-slate-400 mb-6">Our AI is identifying components, features, and specifications</p>
              <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
            </CardContent>
          </Card>
        )}

        {/* ─── STEP 3: REVIEW EXTRACTION ─── */}
        {step === "review" && extraction && (
          <div className="space-y-6">
            {/* Image thumbnails */}
            <div className="flex gap-3">
              {images.map((img, i) => (
                <div key={i} className="w-24 h-24 rounded-lg overflow-hidden border border-white/10">
                  <img src={img.preview} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>

            {/* Product Type */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-indigo-400" />
                  <CardTitle className="text-white text-lg">Product Type Guess</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-lg text-slate-200 font-medium">{extraction.productTypeGuess}</p>
              </CardContent>
            </Card>

            {/* Key Features */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-emerald-400" />
                  <CardTitle className="text-white text-lg">Key Features Identified</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {extraction.keyFeatureGuess.map((feature, i) => (
                    <Badge key={i} variant="outline" className="border-emerald-500/30 text-emerald-300 bg-emerald-500/10 px-3 py-1.5 text-sm">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* What We Still Need */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-400" />
                  <CardTitle className="text-white text-lg">What We Still Need</CardTitle>
                </div>
                <CardDescription className="text-slate-400">
                  Please provide the following information so we can start quoting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {extraction.whatWeStillNeed.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                      <span className="text-amber-400 mt-0.5">•</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Action buttons */}
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/20 text-slate-300" onClick={() => setStep("upload")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold"
                onClick={() => setStep("details")}
              >
                Continue — Fill in Details
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 4: CUSTOMER DETAILS ─── */}
        {step === "details" && extraction && (
          <div className="space-y-6">
            {/* Summary card */}
            <Card className="bg-indigo-500/10 border-indigo-500/20">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Package className="w-5 h-5 text-indigo-400" />
                  <div>
                    <p className="text-sm text-indigo-300 font-medium">Product identified as:</p>
                    <p className="text-white font-semibold">{extraction.productTypeGuess}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact info */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">Your Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Name</Label>
                    <Input value={customerName} onChange={e => setCustomerName(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" placeholder="Your name" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Email</Label>
                    <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" placeholder="your@email.com" type="email" />
                  </div>
                </div>
                <div>
                  <Label className="text-slate-300">Company</Label>
                  <Input value={customerCompany} onChange={e => setCustomerCompany(e.target.value)}
                    className="bg-white/5 border-white/10 text-white" placeholder="Company name" />
                </div>
              </CardContent>
            </Card>

            {/* Project details */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-lg">Project Details</CardTitle>
                <CardDescription className="text-slate-400">Help us understand your requirements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Target Annual Units (EAU)</Label>
                    <Input value={annualUnits} onChange={e => setAnnualUnits(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" placeholder="e.g. 10,000" />
                  </div>
                  <div>
                    <Label className="text-slate-300">Expected SOP</Label>
                    <Input value={expectedSop} onChange={e => setExpectedSop(e.target.value)}
                      className="bg-white/5 border-white/10 text-white" placeholder="e.g. Q3 2026" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-300">Target Region</Label>
                    <Select value={region} onValueChange={(v) => setRegion(v as any)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select region" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="EU">EU</SelectItem>
                        <SelectItem value="US">US</SelectItem>
                        <SelectItem value="APAC">APAC</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-slate-300">Design Intent</Label>
                    <Select value={designIntent} onValueChange={(v) => setDesignIntent(v as any)}>
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Select intent" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="equivalent">1:1 Equivalent</SelectItem>
                        <SelectItem value="modified">Modified Design</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="hasBom"
                    checked={hasBom}
                    onChange={e => setHasBom(e.target.checked)}
                    className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-500"
                  />
                  <Label htmlFor="hasBom" className="text-slate-300 cursor-pointer">
                    I have a BOM, dimensions, or additional technical pictures
                  </Label>
                </div>
                <div>
                  <Label className="text-slate-300">Additional Notes</Label>
                  <Textarea
                    value={customerNotes}
                    onChange={e => setCustomerNotes(e.target.value)}
                    className="bg-white/5 border-white/10 text-white min-h-[100px]"
                    placeholder="Any additional context, requirements, or questions..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-3">
              <Button variant="outline" className="border-white/20 text-slate-300" onClick={() => setStep("review")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                size="lg"
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Submitting...</>
                ) : (
                  <><Send className="w-5 h-5 mr-2" /> Create Prototype Request</>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* ─── STEP 5: SUBMITTED ─── */}
        {step === "submitted" && (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="py-16 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">Request Submitted</h2>
              <p className="text-lg text-slate-300 mb-2 max-w-md">
                Thanks — we're analyzing your pictures. We'll contact you for the next steps.
              </p>
              {requestId && (
                <p className="text-sm text-slate-500 mb-8">Request ID: #{requestId}</p>
              )}
              <Button variant="outline" className="border-white/20 text-slate-300" onClick={resetForm}>
                Submit Another Request
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/png;base64,")
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

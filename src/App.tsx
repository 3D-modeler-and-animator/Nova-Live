import { useState, useEffect, useRef } from "react";
import { 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  onSnapshot,
  updateDoc,
  serverTimestamp,
  Timestamp
} from "firebase/firestore";
import { db } from "./firebase";
import { 
  Video, 
  Mic, 
  MicOff, 
  LogOut, 
  Plus, 
  Users, 
  BookOpen, 
  Shield, 
  Camera, 
  VideoOff,
  ClipboardList,
  ArrowRight,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Toaster, toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { cn } from "./lib/utils";

// --- Types ---

interface Session {
  id: string;
  code: string;
  status: "active" | "completed";
  adminId: string;
  participants: string[];
  createdAt: Timestamp;
}

interface Note {
  sessionId: string;
  content: string;
  updatedAt: Timestamp;
}

// --- Components ---

export default function App() {
  const [loading, setLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [showAdminPasswordPrompt, setShowAdminPasswordPrompt] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");

  const handleAdminToggle = () => {
    if (isAdminAuthenticated) {
      setIsAdminMode(!isAdminMode);
    } else {
      setShowAdminPasswordPrompt(true);
    }
  };

  const verifyAdminPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassword === "Nova-Mentorship") {
      setIsAdminAuthenticated(true);
      setIsAdminMode(true);
      setShowAdminPasswordPrompt(false);
      setAdminPassword("");
      toast.success("Admin access granted");
    } else {
      toast.error("Incorrect admin password");
    }
  };

  const handleLogout = () => {
    setIsAdminMode(false);
    setIsAdminAuthenticated(false);
    setCurrentSessionId(null);
    toast.success("Admin mode deactivated");
  };

  return (
    <div className="h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden flex flex-col">
      <nav className="border-b border-zinc-800 p-4 flex items-center justify-between bg-zinc-900/50 backdrop-blur-xl z-50">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-orange-500 tracking-tight">NOVA LIVE</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={handleAdminToggle}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2",
              isAdminMode 
                ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" 
                : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100"
            )}
          >
            <Shield className="w-4 h-4" />
            ADMIN ACCESS
          </button>

          {isAdminAuthenticated && (
            <button 
              onClick={handleLogout}
              className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-red-400"
              title="Deactivate Admin Mode"
            >
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 overflow-auto p-4 sm:p-8 relative">
        <AnimatePresence mode="wait">
          {currentSessionId ? (
            <SessionView 
              sessionId={currentSessionId} 
              onLeave={() => setCurrentSessionId(null)} 
              isAnonymous={isAdminMode}
            />
          ) : isAdminMode ? (
            <AdminDashboard 
              onJoinSession={setCurrentSessionId} 
            />
          ) : (
            <StudentDashboard 
              onJoinSession={setCurrentSessionId} 
            />
          )}
        </AnimatePresence>

        {/* Admin Password Modal */}
        <AnimatePresence>
          {showAdminPasswordPrompt && (
            <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-sm w-full shadow-2xl space-y-6"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Shield className="w-6 h-6 text-orange-500" />
                  </div>
                  <h3 className="text-xl font-bold">Admin Verification</h3>
                  <p className="text-sm text-zinc-400">Enter the mentorship password to continue</p>
                </div>
                <form onSubmit={verifyAdminPassword} className="space-y-4">
                  <input 
                    type="password"
                    autoFocus
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-center focus:ring-2 focus:ring-orange-500 outline-none transition-all"
                  />
                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowAdminPasswordPrompt(false)}
                      className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-all shadow-lg shadow-orange-500/20"
                    >
                      Verify
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
      <Toaster position="bottom-center" theme="dark" />
    </div>
  );
}

// --- Dashboard Components ---

function StudentDashboard({ onJoinSession }: { onJoinSession: (id: string) => void }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    try {
      const q = query(collection(db, "sessions"), where("code", "==", code), where("status", "==", "active"));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast.error("Invalid or inactive session code");
      } else {
        const sessionDoc = querySnapshot.docs[0];
        onJoinSession(sessionDoc.id);
      }
    } catch (error) {
      toast.error("Error joining session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-md mx-auto mt-20 space-y-8"
    >
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-orange-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <BookOpen className="w-8 h-8 text-orange-500" />
        </div>
        <h2 className="text-3xl font-bold">Join Mentorship</h2>
        <p className="text-zinc-400">Enter the 6-digit code provided by your mentor</p>
      </div>

      <form onSubmit={handleJoin} className="space-y-4">
        <input 
          type="text" 
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ENTER CODE"
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-center text-3xl font-mono tracking-[0.5em] focus:ring-2 focus:ring-orange-500 outline-none transition-all"
        />
        <button 
          disabled={loading || code.length !== 6}
          className="w-full py-4 bg-zinc-100 hover:bg-white text-zinc-950 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Join Session"}
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </motion.div>
  );
}

function AdminDashboard({ onJoinSession }: { onJoinSession: (id: string) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [allSessions, setAllSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"generate" | "supervise">("supervise");

  useEffect(() => {
    // All active sessions for supervision and general management
    const qAll = query(collection(db, "sessions"), where("status", "==", "active"));
    const unsubscribeAll = onSnapshot(qAll, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Session));
      setAllSessions(docs);
      setSessions(docs); // In simplified mode, we show all active sessions
    });

    return () => {
      unsubscribeAll();
    };
  }, []);

  const createSession = async () => {
    setLoading(true);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      await addDoc(collection(db, "sessions"), {
        code,
        status: "active",
        adminId: "system-admin", // Simplified
        participants: [],
        createdAt: serverTimestamp()
      });
      toast.success(`Session ${code} created`);
    } catch (error) {
      toast.error("Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold">Mentor Dashboard</h2>
          <p className="text-zinc-400">Manage and supervise mentorship sessions</p>
        </div>
        
        <div className="flex bg-zinc-900 p-1 rounded-2xl border border-zinc-800">
          <button 
            onClick={() => setActiveTab("generate")}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === "generate" ? "bg-zinc-800 text-orange-500" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Generate Codes
          </button>
          <button 
            onClick={() => setActiveTab("supervise")}
            className={cn(
              "px-6 py-2 rounded-xl text-sm font-bold transition-all",
              activeTab === "supervise" ? "bg-zinc-800 text-orange-500" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Supervise Live
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "generate" ? (
          <motion.div 
            key="generate"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-orange-500" />
                Active Sessions
              </h3>
              <button 
                onClick={createSession}
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20"
              >
                <Plus className="w-5 h-5" />
                New Session
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sessions.map((session) => (
                <div key={session.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl space-y-4 hover:border-orange-500/50 transition-all group">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Session Code</p>
                      <p className="text-2xl font-mono font-bold text-orange-500">{session.code}</p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase",
                      session.status === "active" ? "bg-green-500/10 text-green-500" : "bg-zinc-800 text-zinc-500"
                    )}>
                      {session.status}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-zinc-800">
                    <div className="flex items-center gap-2 text-zinc-400">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">{session.participants.length} Active</span>
                    </div>
                    <button 
                      onClick={() => onJoinSession(session.id)}
                      className="text-sm font-bold text-zinc-100 hover:text-orange-500 transition-colors flex items-center gap-1"
                    >
                      Join Session <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                  <ClipboardList className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500">No sessions created yet. Start by creating a new one.</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div 
            key="supervise"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-6"
          >
            <h3 className="text-xl font-bold flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Live Supervision
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {allSessions.map((session) => (
                <div key={session.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between hover:border-orange-500/30 transition-all">
                  <div className="flex items-center gap-6">
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800">
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-tighter">CODE</p>
                      <p className="text-xl font-mono font-bold text-orange-500">{session.code}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-100">Active Session</p>
                      <p className="text-xs text-zinc-500 flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {session.participants.length} participants connected
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => onJoinSession(session.id)}
                    className="bg-zinc-800 hover:bg-orange-500 text-zinc-100 hover:text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  >
                    <Video className="w-4 h-4" />
                    Join Anonymously
                  </button>
                </div>
              ))}
              {allSessions.length === 0 && (
                <div className="py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl">
                  <VideoOff className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                  <p className="text-zinc-500">No active sessions to supervise at the moment.</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// --- Session View ---

function SessionView({ sessionId, onLeave, isAnonymous }: { 
  sessionId: string, 
  onLeave: () => void, 
  isAnonymous?: boolean
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [note, setNote] = useState<Note | null>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [participantId] = useState(() => Math.random().toString(36).substring(7));
  const [isRemoteConnected, setIsRemoteConnected] = useState(false);

  const servers = {
    iceServers: [
      {
        urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  useEffect(() => {
    const sessionRef = doc(db, "sessions", sessionId);
    const unsubscribe = onSnapshot(sessionRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as Session;
        setSession(data);
        
        // Add self to participants if not already there AND not anonymous
        if (!isAnonymous && !data.participants.includes(participantId)) {
          updateDoc(sessionRef, {
            participants: [...data.participants, participantId]
          });
        }
      }
    });

    const noteRef = doc(db, "notes", sessionId);
    const unsubscribeNote = onSnapshot(noteRef, (snapshot) => {
      if (snapshot.exists()) {
        setNote(snapshot.data() as Note);
      }
    });

    // WebRTC Setup
    const setupWebRTC = async () => {
      const pc = new RTCPeerConnection(servers);
      peerConnection.current = pc;

      // Get local stream
      const localStream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      setStream(localStream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStream;
      }

      // Add tracks to peer connection
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

      // Listen for remote tracks
      pc.ontrack = (event) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = event.streams[0];
          setIsRemoteConnected(true);
        }
      };

      // Signaling logic
      const callDoc = doc(collection(db, "sessions", sessionId, "calls"), "signaling");
      const offerCandidates = collection(callDoc, "offerCandidates");
      const answerCandidates = collection(callDoc, "answerCandidates");

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidatesCollection = pc.localDescription?.type === 'offer' ? offerCandidates : answerCandidates;
          addDoc(candidatesCollection, event.candidate.toJSON());
        }
      };

      // Determine role based on existing call doc
      const callSnapshot = await getDoc(callDoc);
      
      if (!callSnapshot.exists()) {
        // I am the caller
        const offerDescription = await pc.createOffer();
        await pc.setLocalDescription(offerDescription);

        const offer = {
          sdp: offerDescription.sdp,
          type: offerDescription.type,
        };

        await setDoc(callDoc, { offer });

        // Listen for answer
        onSnapshot(callDoc, (snapshot) => {
          const data = snapshot.data();
          if (!pc.currentRemoteDescription && data?.answer) {
            const answerDescription = new RTCSessionDescription(data.answer);
            pc.setRemoteDescription(answerDescription);
          }
        });

        // Listen for callee candidates
        onSnapshot(answerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              pc.addIceCandidate(new RTCIceCandidate(data));
            }
          });
        });
      } else {
        // I am the callee
        const data = callSnapshot.data();
        const offerDescription = data.offer;
        await pc.setRemoteDescription(new RTCSessionDescription(offerDescription));

        const answerDescription = await pc.createAnswer();
        await pc.setLocalDescription(answerDescription);

        const answer = {
          type: answerDescription.type,
          sdp: answerDescription.sdp,
        };

        await updateDoc(callDoc, { answer });

        // Listen for caller candidates
        onSnapshot(offerCandidates, (snapshot) => {
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              const data = change.doc.data();
              pc.addIceCandidate(new RTCIceCandidate(data));
            }
          });
        });
      }
    };

    setupWebRTC();

    return () => {
      unsubscribe();
      unsubscribeNote();
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (peerConnection.current) {
        peerConnection.current.close();
      }
    };
  }, [sessionId, isAnonymous, participantId]);

  const toggleMic = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  };

  const updateNote = async (content: string) => {
    const noteRef = doc(db, "notes", sessionId);
    await updateDoc(noteRef, {
      content,
      updatedAt: serverTimestamp()
    });
  };

  const leaveSession = async () => {
    if (session && !isAnonymous) {
      const sessionRef = doc(db, "sessions", sessionId);
      await updateDoc(sessionRef, {
        participants: session.participants.filter(id => id !== participantId)
      });
    }
    onLeave();
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col lg:flex-row gap-6"
    >
      {/* Video Grid */}
      <div className="flex-1 flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {/* Local Video */}
          <div className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl group">
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full h-full object-cover mirror"
            />
            <div className="absolute bottom-4 left-4 bg-zinc-950/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              {isAnonymous ? "Supervisor (Incognito)" : "You"}
            </div>
            {!isMicOn && (
              <div className="absolute top-4 right-4 bg-red-500 p-2 rounded-full shadow-lg">
                <MicOff className="w-4 h-4 text-white" />
              </div>
            )}
          </div>

          {/* Remote Video */}
          <div className="relative bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl flex items-center justify-center">
            {isRemoteConnected ? (
              <video 
                ref={remoteVideoRef} 
                autoPlay 
                playsInline 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mx-auto">
                  <Users className="w-10 h-10 text-zinc-600" />
                </div>
                <p className="text-zinc-500 font-medium">Waiting for participant...</p>
              </div>
            )}
            <div className="absolute bottom-4 left-4 bg-zinc-950/50 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-medium">
              Participant
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-4 rounded-3xl flex items-center justify-center gap-4">
          <button 
            onClick={toggleMic}
            className={cn(
              "p-4 rounded-2xl transition-all",
              isMicOn ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-100" : "bg-red-500 hover:bg-red-600 text-white"
            )}
          >
            {isMicOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
          </button>
          <button 
            disabled
            className="p-4 rounded-2xl bg-zinc-800 text-zinc-500 cursor-not-allowed"
          >
            <Camera className="w-6 h-6" />
          </button>
          <button 
            onClick={leaveSession}
            className="px-8 py-4 bg-red-500 hover:bg-red-600 text-white rounded-2xl font-bold transition-all"
          >
            {isAnonymous ? "Stop Supervising" : "End Session"}
          </button>
        </div>
      </div>

      {/* Shared Notepad */}
      <div className="w-full lg:w-96 flex flex-col bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-800/30">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-orange-500" />
            <h3 className="font-bold">Shared Notepad</h3>
          </div>
          <button 
            onClick={() => setIsEditing(!isEditing)}
            className="text-xs font-bold text-orange-500 hover:text-orange-400"
          >
            {isEditing ? "Preview" : "Edit"}
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {isEditing ? (
            <textarea 
              value={note?.content || ""}
              onChange={(e) => updateNote(e.target.value)}
              className="w-full h-full bg-transparent outline-none resize-none font-mono text-sm"
              placeholder="Write something..."
            />
          ) : (
            <div className="prose prose-invert prose-orange max-w-none">
              <ReactMarkdown>{note?.content || ""}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className="p-3 bg-zinc-950/50 text-[10px] text-zinc-500 flex items-center justify-between">
          <span>Markdown supported</span>
          <span>Last sync: {note?.updatedAt?.toDate().toLocaleTimeString()}</span>
        </div>
      </div>
    </motion.div>
  );
}

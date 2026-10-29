export default function VoiceLottie({ isSpeaking }) {
  return (
    <div
      style={{
        width: "300px",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        fontSize: "48px",
      }}
      aria-label={isSpeaking ? "Voice speaking" : "Voice idle"}
    >
      {isSpeaking ? "🔊" : "🔈"}
    </div>
  );
}
export default function MicLottie({ listening, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mic-button"
      title={listening ? "Tap to stop" : "Tap to speak"}
      aria-label={listening ? "Stop speaking" : "Start speaking"}
    >
      {listening ? "🔴" : "🎙️"}
    </button>
  );
}

import { CAPTURE_MAX_HEIGHT, CAPTURE_MAX_LINE, CAPTURE_MAX_WIDTH } from './capture-protocol';

/** Included in the resident helper only with effective screen permission. No disk I/O. */
export const captureMethods = String.raw`
  static string PendingCapture;
  public static void QueueCapture(string line) {
    if (!ValidCapture(line)) { Console.WriteLine("capture|skip|invalid"); return; }
    if (System.Threading.Interlocked.CompareExchange(ref PendingCapture, line, null) != null) {
      Console.WriteLine("capture|skip|busy"); return;
    }
    Wake.Set();
  }
  public static bool ValidCapture(string line) {
    if (line.Length > 40 || !System.Text.RegularExpressions.Regex.IsMatch(line, @"\Acapture [1-9][0-9]{0,18} [1-9][0-9]{0,3} [1-9][0-9]{0,3}\z")) return false;
    string[] parts = line.Split(' '); long handle; int width, height;
    return Int64.TryParse(parts[1], out handle) && handle > 0 && (IntPtr.Size == 8 || handle <= Int32.MaxValue)
      && Int32.TryParse(parts[2], out width) && width <= ${CAPTURE_MAX_WIDTH}
      && Int32.TryParse(parts[3], out height) && height <= ${CAPTURE_MAX_HEIGHT};
  }
  public static void FlushCapture() {
    string line = System.Threading.Interlocked.Exchange(ref PendingCapture, null);
    if (line != null) { Console.WriteLine(Capture(line)); Console.Out.Flush(); }
  }
  static string CaptureReason(IntPtr hwnd, out RECT rect) {
    rect = new RECT();
    if (hwnd != GetForegroundWindow()) return "foreground";
    if (!IsWindow(hwnd)) return "unavailable";
    if (IsIconic(hwnd)) return "minimized";
    uint pid;
    if (GetWindowThreadProcessId(hwnd, out pid) == 0) return "unavailable";
    if (Array.IndexOf(Own, pid) >= 0) return "self";
    MONITORINFO info = new MONITORINFO(); info.Size = Marshal.SizeOf(info);
    if (!GetWindowRect(hwnd, out rect) || !GetMonitorInfo(MonitorFromWindow(hwnd, 2), ref info)) return "unavailable";
    if (rect.L <= info.Monitor.L && rect.T <= info.Monitor.T && rect.R >= info.Monitor.R && rect.B >= info.Monitor.B) return "fullscreen";
    // Inspect re-runs the SAME executable, explicit exclusion and private-title checks as sampling,
    // against this exact HWND. Unknown identity fails closed before any bitmap is rendered.
    string identity = Inspect(hwnd, Own).Split('|')[0];
    if (identity == "private" || identity == "self") return identity;
    if (identity == "unknown" || hwnd != GetForegroundWindow()) return "unavailable";
    return null;
  }
  public static string Capture(string line) {
    if (!ValidCapture(line)) return "capture|skip|invalid";
    try {
      string[] parts = line.Split(' ');
      IntPtr hwnd = new IntPtr(Int64.Parse(parts[1]));
      int maxW = Int32.Parse(parts[2]), maxH = Int32.Parse(parts[3]);
      RECT rect; string reason = CaptureReason(hwnd, out rect);
      if (reason != null) return "capture|skip|" + reason;
      long width = (long)rect.R - rect.L, height = (long)rect.B - rect.T;
      if (width <= 0 || height <= 0 || width > 16384 || height > 16384 || width * height > 33554432) return "capture|skip|size";
      using (var bitmap = new System.Drawing.Bitmap((int)width, (int)height, System.Drawing.Imaging.PixelFormat.Format32bppRgb)) {
        using (var graphics = System.Drawing.Graphics.FromImage(bitmap)) {
          graphics.Clear(System.Drawing.Color.Black);
          IntPtr hdc = graphics.GetHdc();
          try {
            RECT current; reason = CaptureReason(hwnd, out current);
            if (reason != null) return "capture|skip|" + reason;
            if (current.R - (long)current.L != width || current.B - (long)current.T != height) return "capture|skip|size";
            // Render exactly the permitted HWND; never enumerate windows or copy the desktop.
            if (!PrintWindow(hwnd, hdc, 2)) return "capture|skip|render"; // PW_RENDERFULLCONTENT
          } finally { graphics.ReleaseHdc(hdc); }
        }
        RECT after; reason = CaptureReason(hwnd, out after);
        if (reason != null) return "capture|skip|" + reason;
        double scale = Math.Min(1.0, Math.Min(maxW / (double)width, maxH / (double)height));
        using (var resized = new System.Drawing.Bitmap(Math.Max(1, (int)(width * scale)), Math.Max(1, (int)(height * scale)))) {
          using (var graphics = System.Drawing.Graphics.FromImage(resized)) {
            graphics.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
            graphics.DrawImage(bitmap, 0, 0, resized.Width, resized.Height);
          }
          System.Drawing.Imaging.ImageCodecInfo codec = Array.Find(System.Drawing.Imaging.ImageCodecInfo.GetImageEncoders(), item => item.MimeType == "image/jpeg");
          if (codec == null) return "capture|skip|unavailable";
          for (long quality = 70; quality >= 10; quality -= 10) {
            using (var stream = new MemoryStream())
            using (var parameters = new System.Drawing.Imaging.EncoderParameters(1)) {
              parameters.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, quality);
              resized.Save(stream, codec, parameters);
              // Bound the base64 line including its prefix and CRLF, not just the JPEG bytes.
              if (11 + 4 * ((stream.Length + 2) / 3) + 2 <= ${CAPTURE_MAX_LINE}) return "capture|ok|" + Convert.ToBase64String(stream.ToArray());
            }
          }
        }
      }
      return "capture|skip|oversized";
    } catch { return "capture|skip|unavailable"; }
  }
  [DllImport("user32.dll")] static extern bool IsWindow(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool IsIconic(IntPtr hwnd);
  [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr hwnd, IntPtr hdc, uint flags);
`;

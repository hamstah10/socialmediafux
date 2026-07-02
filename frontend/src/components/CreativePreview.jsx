// Shared client-side preview renderer for creatives. Kept identical (visually)
// to the server-side build_preview_html in backend/services/creative.py so
// what the user sees in the editor matches what a PNG export would render.

export const FORMAT_SIZES = {
  instagram_square: { w: 1080, h: 1080, label: "Instagram Square" },
  instagram_portrait: { w: 1080, h: 1350, label: "Instagram Portrait (4:5)" },
  instagram_story: { w: 1080, h: 1920, label: "Instagram Story" },
  facebook_landscape: { w: 1200, h: 630, label: "Facebook Landscape" },
  linkedin_square: { w: 1200, h: 1200, label: "LinkedIn Square" },
  google_business: { w: 1200, h: 900, label: "Google Business" },
  blog_thumbnail: { w: 1200, h: 675, label: "Blog Thumbnail" },
  website_hero: { w: 1600, h: 900, label: "Website Hero" },
};

export const BACKGROUND_TYPES = ["grid", "diagonal", "lines", "clean"];

const backgroundCss = (bg, primary) => {
  switch (bg) {
    case "diagonal":
      return {
        background: primary,
        backgroundImage:
          "repeating-linear-gradient(135deg, rgba(35,45,66,0.55) 0 1px, transparent 1px 60px)",
      };
    case "lines":
      return {
        background: primary,
        backgroundImage:
          "repeating-linear-gradient(0deg, rgba(35,45,66,0.5) 0 1px, transparent 1px 24px)",
      };
    case "clean":
      return { background: primary };
    case "grid":
    default:
      return {
        background: primary,
        backgroundImage:
          "linear-gradient(#232D42 1px,transparent 1px),linear-gradient(90deg,#232D42 1px,transparent 1px)",
        backgroundSize: "40px 40px",
      };
  }
};

export default function CreativePreview({
  customer,
  template,
  format = "instagram_square",
  headline,
  subline,
  cta,
  logoUrl,
  backgroundImageUrl,
  maxWidth = 640,
  testid,
}) {
  const fmt = FORMAT_SIZES[format] || FORMAT_SIZES.instagram_square;
  const config = template?.config || {};
  const accent = customer?.accent_color || config.accent || "#B4E600";
  const primary = customer?.primary_color || config.background_color || "#080D1A";
  const badge = config.badge || customer?.tone_of_voice || "Update";
  const bgType = template?.background_type || "grid";
  const website = customer?.website || "";
  const name = customer?.name || "";

  const patternCss = backgroundCss(bgType, primary);
  const bgImageCss = backgroundImageUrl
    ? {
        backgroundImage: `linear-gradient(rgba(8,13,26,0.55), rgba(8,13,26,0.75)), url("${backgroundImageUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        background: undefined,
      }
    : {};

  return (
    <div style={{ maxWidth }} className="mx-auto">
      <div
        data-testid={testid || "creative-preview"}
        style={{
          width: "100%",
          aspectRatio: `${fmt.w}/${fmt.h}`,
          color: "#F5F7FA",
          position: "relative",
          fontFamily: "'Rajdhani','IBM Plex Sans',sans-serif",
          overflow: "hidden",
          border: "1px solid #232D42",
          ...patternCss,
          ...bgImageCss,
        }}
      >
        <div style={{ position: "absolute", inset: 0, padding: "8%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ padding: "6px 12px", background: accent, color: "#080D1A", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".15em", fontSize: "0.75rem" }}>
              {badge}
            </div>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain" }} />
            ) : (
              <div style={{ fontWeight: 800, textTransform: "uppercase", letterSpacing: ".1em" }}>{name}</div>
            )}
          </div>
          <div>
            <h2 style={{
              fontSize: "clamp(1.5rem, 3.5vw, 3rem)", lineHeight: 1.05, margin: 0,
              fontWeight: 800, textTransform: "uppercase", letterSpacing: "-0.02em",
            }}>
              {headline}
            </h2>
            {subline && (
              <p style={{ marginTop: "1rem", fontSize: "1.05rem", color: "#F5F7FA", opacity: 0.85, maxWidth: "80%" }}>
                {subline}
              </p>
            )}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ padding: "12px 20px", background: accent, color: "#080D1A", fontWeight: 700, textTransform: "uppercase", letterSpacing: ".12em", fontSize: "0.9rem" }}>
              {cta || "Jetzt anfragen"}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#8A94A6", textTransform: "uppercase", letterSpacing: ".15em" }}>
              {website}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

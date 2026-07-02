"""Pydantic schemas for SocialFUX API."""
from pydantic import BaseModel, Field
from typing import Optional, List, Any


# ---------- Auth ----------
class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: dict


class UserOut(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool = True
    customer_id: Optional[str] = None


# ---------- Customer ----------
class CustomerBase(BaseModel):
    name: str
    slug: Optional[str] = None
    primary_color: str = "#080D1A"
    secondary_color: str = "#0F1526"
    accent_color: str = "#B4E600"
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    language: str = "de"
    tone_of_voice: str = "technisch"
    services: List[str] = Field(default_factory=list)
    social_links: dict = Field(default_factory=dict)
    notes: Optional[str] = None
    is_active: bool = True


class CustomerCreate(CustomerBase):
    pass


class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    accent_color: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    language: Optional[str] = None
    tone_of_voice: Optional[str] = None
    services: Optional[List[str]] = None
    social_links: Optional[dict] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


# ---------- News Source ----------
class NewsSourceBase(BaseModel):
    name: str
    url: Optional[str] = None
    rss_url: Optional[str] = None
    source_type: str = "rss"  # rss | website | manual
    scraper_key: str = "generic_rss"
    active: bool = True


class NewsSourceCreate(NewsSourceBase):
    pass


class NewsSourceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    rss_url: Optional[str] = None
    source_type: Optional[str] = None
    scraper_key: Optional[str] = None
    active: Optional[bool] = None


# ---------- News Item ----------
class NewsItemStatusUpdate(BaseModel):
    status: str  # new | reviewed | used | ignored | archived


class ImportUrlRequest(BaseModel):
    url: str
    news_source_id: Optional[str] = None


class PreviewUrlRequest(BaseModel):
    url: str


class NewsItemCreate(BaseModel):
    title: str
    url: str
    summary: str = ""
    content_clean: str = ""
    image_url: Optional[str] = None
    published_at: Optional[str] = None
    category: Optional[str] = None
    news_source_id: Optional[str] = None


# ---------- Generator ----------
class GenerateContentRequest(BaseModel):
    customer_id: str
    news_item_id: Optional[str] = None
    platform: str = "instagram"  # instagram | facebook | linkedin | google_business | blog | newsletter | whatsapp
    content_type: str = "post"
    tone: Optional[str] = None
    cta: Optional[str] = None
    target_link: Optional[str] = None
    custom_prompt: Optional[str] = None


class GenerateVariantsRequest(GenerateContentRequest):
    """Generates 3 variants (technisch / verkaufsstark / kurz)."""
    pass


class SafeRewriteRequest(BaseModel):
    text: str
    customer_id: Optional[str] = None


class HashtagRequest(BaseModel):
    text: str
    customer_id: Optional[str] = None
    platform: str = "instagram"
    count: int = 12


class ComplianceRequest(BaseModel):
    text: str


class GeneratedContentUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None
    hashtags: Optional[List[str]] = None
    cta: Optional[str] = None
    target_link: Optional[str] = None
    status: Optional[str] = None
    tone: Optional[str] = None


# ---------- Creative ----------
class CreativeCreate(BaseModel):
    customer_id: str
    generated_content_id: Optional[str] = None
    design_template_id: Optional[str] = None
    format: str = "instagram_square"
    headline: str
    subline: Optional[str] = ""
    cta: Optional[str] = ""
    background_image_path: Optional[str] = None
    logo_override_path: Optional[str] = None
    layers: Optional[List[dict]] = None
    groups: Optional[List[dict]] = None


class CreativeUpdate(BaseModel):
    headline: Optional[str] = None
    subline: Optional[str] = None
    cta: Optional[str] = None
    design_template_id: Optional[str] = None
    format: Optional[str] = None
    status: Optional[str] = None
    preview_html: Optional[str] = None
    background_image_path: Optional[str] = None
    logo_override_path: Optional[str] = None
    layers: Optional[List[dict]] = None
    groups: Optional[List[dict]] = None


# ---------- Template ----------
class TemplateCreate(BaseModel):
    name: str
    format: str = "instagram_square"
    width: int = 1080
    height: int = 1080
    style_key: str = "ecu_update"
    background_type: str = "grid"
    customer_id: Optional[str] = None
    is_global: bool = True
    config: dict = Field(default_factory=dict)


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    format: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    style_key: Optional[str] = None
    background_type: Optional[str] = None
    is_global: Optional[bool] = None
    config: Optional[dict] = None


# ---------- Approval workflow ----------
class TransitionRequest(BaseModel):
    status: str  # target status
    note: Optional[str] = None


# ---------- Approval Links (public) ----------
class ApprovalCreateRequest(BaseModel):
    generated_content_id: Optional[str] = None
    generated_creative_id: Optional[str] = None
    expires_in_days: int = 14


class ApprovalDecision(BaseModel):
    comment: Optional[str] = None


# ---------- Layout Templates (Layout Editor save/load) ----------
class LayoutTemplateCreate(BaseModel):
    name: str
    customer_id: Optional[str] = None  # None → global template
    is_global: bool = False
    format: str = "instagram_square"
    layers: List[dict] = Field(default_factory=list)
    groups: List[dict] = Field(default_factory=list)
    thumbnail_path: Optional[str] = None


class LayoutTemplateUpdate(BaseModel):
    name: Optional[str] = None
    customer_id: Optional[str] = None
    is_global: Optional[bool] = None
    format: Optional[str] = None
    layers: Optional[List[dict]] = None
    groups: Optional[List[dict]] = None
    thumbnail_path: Optional[str] = None


# ---------- Bulk generation ----------
class BulkFromNewsRequest(BaseModel):
    customer_id: str
    layout_template_id: str
    news_item_ids: List[str]
    platform: str = "instagram"
    content_type: str = "post"
    tone: Optional[str] = None
    cta: Optional[str] = None
    target_link: Optional[str] = None
    custom_prompt: Optional[str] = None

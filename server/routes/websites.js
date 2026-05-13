import { Router } from "express";
import { supabase } from "../lib/supabase.js";
import {
  getFallbackWorkspaceContext,
  getDefaultWorkspace,
  isSupabaseUnavailableError,
  normalizeWebsitePayload
} from "../services/platformDataService.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const workspace = await getDefaultWorkspace();
    const { data: websites, error } = await supabase
      .from("websites")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return res.json({ websites: websites ?? [] });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.json({ websites: [] });
    }
    return res.status(500).json({ error: error.message || "Failed to load websites." });
  }
});

router.get("/:websiteId", async (req, res) => {
  try {
    const workspace = await getDefaultWorkspace();
    const { websiteId } = req.params;

    const { data: website, error } = await supabase
      .from("websites")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("id", websiteId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!website) {
      return res.status(404).json({ error: "Website not found." });
    }

    const { data: scans, error: scansError } = await supabase
      .from("scans")
      .select("*")
      .eq("website_id", websiteId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (scansError) throw new Error(scansError.message);

    return res.json({ website, scans: scans ?? [] });
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.status(404).json({ error: "Website not found." });
    }
    return res.status(500).json({ error: error.message || "Failed to load website detail." });
  }
});

router.post("/", async (req, res) => {
  try {
    const workspace = await getDefaultWorkspace();
    const payload = normalizeWebsitePayload(req.body ?? {});
    const { data, error } = await supabase
      .from("websites")
      .insert({
        workspace_id: workspace.id,
        ...payload
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);

    return res.status(201).json(data);
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      const fallbackWorkspace = getFallbackWorkspaceContext().workspace;
      return res.status(503).json({
        error: "Website storage is temporarily unavailable because Supabase is unreachable.",
        workspaceId: fallbackWorkspace.id
      });
    }
    return res.status(500).json({ error: error.message || "Failed to create website." });
  }
});

router.patch("/:websiteId", async (req, res) => {
  try {
    const workspace = await getDefaultWorkspace();
    const { websiteId } = req.params;
    const payload = normalizeWebsitePayload(req.body ?? {});

    const { data, error } = await supabase
      .from("websites")
      .update(payload)
      .eq("workspace_id", workspace.id)
      .eq("id", websiteId)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) {
      return res.status(404).json({ error: "Website not found." });
    }

    return res.json(data);
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.status(503).json({ error: "Website storage is temporarily unavailable because Supabase is unreachable." });
    }
    return res.status(500).json({ error: error.message || "Failed to update website." });
  }
});

router.delete("/:websiteId", async (req, res) => {
  try {
    const workspace = await getDefaultWorkspace();
    const { websiteId } = req.params;

    const { data: existing, error: lookupError } = await supabase
      .from("websites")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("id", websiteId)
      .maybeSingle();

    if (lookupError) throw new Error(lookupError.message);
    if (!existing) {
      return res.status(404).json({ error: "Website not found." });
    }

    const { error } = await supabase
      .from("websites")
      .delete()
      .eq("workspace_id", workspace.id)
      .eq("id", websiteId);

    if (error) throw new Error(error.message);

    return res.status(204).send();
  } catch (error) {
    if (isSupabaseUnavailableError(error)) {
      return res.status(503).json({ error: "Website storage is temporarily unavailable because Supabase is unreachable." });
    }
    return res.status(500).json({ error: error.message || "Failed to delete website." });
  }
});

export default router;

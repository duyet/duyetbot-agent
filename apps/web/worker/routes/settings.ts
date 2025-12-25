/**
 * Settings API Routes
 *
 * Handles user settings retrieval and updates.
 */

import { Hono } from 'hono';
import { getUser, requireAuth } from '../lib/auth-middleware';
import { getUserSettings, upsertUserSettings } from '../lib/db/queries';

type Bindings = {
  DB: D1Database;
};

const settingsRouter = new Hono<{ Bindings: Bindings }>();

interface SettingsUpdate {
  defaultModel?: string | null;
  enabledTools?: string[] | null;
  theme?: string | null;
  accentColor?: string | null;
}

/**
 * GET /api/v1/settings
 * Get user settings
 */
settingsRouter.get('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);

  try {
    const settings = await getUserSettings(db, user.id);

    if (!settings) {
      // Return default settings for new users
      return c.json({
        defaultModel: null,
        enabledTools: null,
        theme: null,
        accentColor: null,
      });
    }

    return c.json({
      defaultModel: settings.default_model,
      enabledTools: settings.enabled_tools ? JSON.parse(settings.enabled_tools) : null,
      theme: settings.theme,
      accentColor: settings.accent_color,
    });
  } catch (error) {
    console.error('[Settings API] Error fetching settings:', error);
    return c.json({ error: 'Failed to fetch settings' }, 500);
  }
});

/**
 * PUT /api/v1/settings
 * Update user settings
 *
 * Body:
 * - defaultModel: string | null
 * - enabledTools: string[] | null
 * - theme: string | null
 * - accentColor: string | null
 */
settingsRouter.put('/', requireAuth, async (c) => {
  const db = c.env.DB;
  const user = getUser(c);

  try {
    const body = (await c.req.json()) as SettingsUpdate;

    // Validate settings if provided
    if (
      body.defaultModel !== undefined &&
      typeof body.defaultModel !== 'string' &&
      body.defaultModel !== null
    ) {
      return c.json({ error: 'Invalid defaultModel' }, 400);
    }

    if (
      body.enabledTools !== undefined &&
      !Array.isArray(body.enabledTools) &&
      body.enabledTools !== null
    ) {
      return c.json({ error: 'Invalid enabledTools' }, 400);
    }

    if (body.theme !== undefined && typeof body.theme !== 'string' && body.theme !== null) {
      return c.json({ error: 'Invalid theme' }, 400);
    }

    if (
      body.accentColor !== undefined &&
      typeof body.accentColor !== 'string' &&
      body.accentColor !== null
    ) {
      return c.json({ error: 'Invalid accentColor' }, 400);
    }

    await upsertUserSettings(db, user.id, {
      defaultModel: body.defaultModel,
      enabledTools: body.enabledTools,
      theme: body.theme,
      accentColor: body.accentColor,
    });

    return c.json({ success: true });
  } catch (error) {
    console.error('[Settings API] Error updating settings:', error);
    return c.json({ error: 'Failed to update settings' }, 500);
  }
});

export { settingsRouter };

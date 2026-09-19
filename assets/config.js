/* =====================================================================
   PLAYVERSE  |  SETTINGS
   This is the ONLY file you normally need to edit.
   ===================================================================== */
window.PLAYVERSE_CONFIG = {

  /* 1. Supabase keys  (Supabase > Project Settings > API)
        Use the "Project URL" and the "anon public" key.
        NEVER paste the "service_role" key here. */
  SUPABASE_URL: "https://ydnmvyzrhskwhkeioket.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_n_ZE0v3AZm0Q3-dbW-GkFA_-z0GoJr1",

  /* 2. Event */
  EVENT_NAME: "PlayVerse",
  EVENT_TAGLINE: "The E-Gaming Event",

  /* 3. Payment details shown on every online form (as per requirement doc) */
  PAYMENT: {
    method: "Easypaisa",
    number: "03133129394",
    name: "Mehmood Hussain"
  },

  /* 4. Rules link for the "Event Rules" agreement.
        Paste a link to the rules page / PDF. Leave "" to hide the link. */
  RULES_URL: "",

  /* 5. Receipt upload limit in MB (the database also enforces 5 MB) */
  MAX_FILE_MB: 5,

  /* 6. Department dropdown ("Other" is added automatically) */
  DEPARTMENTS: [
    "Software Engineering",
    "Computer System Engineering",
    "Computer Science",
    "Biomedical Engineering",
    "Electrical Engineering"
  ],

  /* 7. Games. Entry fees, open/closed and slot limits are NOT here:
        the Super Admin changes them inside the CRM (Admin > Games & fees). */
  GAMES: [
    { slug: "pubg",         name: "PUBG",         type: "team",       icon: "crosshair", color: "#F5A524",
      blurb: "Squad up: 4 players, one team, one registration." },
    { slug: "tekken",       name: "Tekken",       type: "individual", icon: "zap",       color: "#F0455A",
      blurb: "1v1 fighting. Bring your best combos." },
    { slug: "fifa",         name: "FIFA",         type: "individual", icon: "ball",      color: "#2FBF71",
      blurb: "Solo football showdown on the pitch." },
    { slug: "mini-militia", name: "Mini Militia", type: "individual", icon: "rocket",    color: "#22B8CF",
      blurb: "Fast, chaotic, jetpack-powered shooting." },
    { slug: "mafia-wars",   name: "Mafia Wars",   type: "individual", icon: "mask",      color: "#B36BFF",
      blurb: "Bluff, deceive and outsmart the table." }
  ]
};

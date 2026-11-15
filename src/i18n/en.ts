/**
 * English — the canonical dictionary. `Dict = typeof en` is the contract every
 * other language must satisfy, so TypeScript flags any missing key or mismatched
 * template signature. Templated strings are FUNCTIONS of their numbers/words, so
 * translations substitute values rather than concatenating English fragments.
 */

const sgn = (n: number) => (n >= 0 ? "+" : "−") + Math.abs(n);

const en = {
  langName: { en: "English", ru: "Русский", tg: "Тоҷикӣ" },

  nav: {
    field: "Field",
    changed: "What changed",
    plan: "Your plan",
  },

  header: { fieldLabel: "Field", language: "Language", steps: "Steps" },

  tab: {
    field: "Your field",
    changed: "What changed",
    plan: "Your plan",
  },

  field: {
    title: "Where is your field?",
    subtitle: "Spin the globe, search a place, or use your location. Zoom in and tap to drop a pin.",
    searchLabel: "Search a place",
    searchPlaceholder: "e.g. Nakuru, Kenya",
    searchBtn: "Search",
    searching: "…",
    noResults: "No places found for that search.",
    searchError: "Search is unavailable right now. Try again shortly.",
    useLocation: "Use my location",
    noGeoSupport: "Your browser doesn't support location.",
    geoError:
      "We couldn't get your location. Allow location access, or pick your field on the map.",
    tryExample: "Try an example",
    selectedField: "Selected field",
    yourField: "Your field",
    noFieldYet: "No field picked yet. Spin the globe and tap a point, or try an example.",
    nasaData: "NASA data for this field",
    pickToStart: "Pick a field to start",
    statusLoading: "loading…",
    statusUnavailable: "unavailable",
    dsClimate: "Climate since 1995",
    dsWater: "Water underground",
    dsTerrain: "Terrain",
    dsSoil: "Soil (shown above)",
    continue: "See the conditions →",
    mapStyle: "Map style",
    layerMap: "Map",
    layerSatellite: "Satellite",
    willRead: "What we'll read for this point",
  },

  examples: {
    vakhsh: "Vakhsh valley, Tajikistan",
    punjab: "Punjab, India",
    nakuru: "Nakuru, Kenya",
  },

  map: {
    continentsLabel: "Fly to a continent",
    zoomHint: "Zoom in to pick your field",
    continents: {
      asia: "Asia",
      africa: "Africa",
      europe: "Europe",
      americas: "Americas",
      oceania: "Oceania",
    },
  },

  climate: {
    title: "Here's what your field is dealing with",
    subtitle: "Comparing 1995–2004 with 2015–2024, from NASA & open Earth data",
    pickTitle: "Pick a field first",
    pickHint: "Choose a point on the map so we can pull its NASA climate record.",
    loadingSub: "Fetching 30 years of monthly climate data for this field.",
    statSummerTemp: "Summer temperature",
    statRainfall: "Yearly rainfall",
    statHotMonths: "Very hot months (>35 °C)",
    statWarmingTrend: "Summer warming trend",
    subChangeVsBaseline: "change vs. 1995–2004",
    subPerDecade: "per decade (1995–2024)",
    hotMonthsSub: (p: { a: number; b: number }) => `${p.a} → ${p.b} per decade`,
    continue: "Plan the next four years →",
    seeMeasurements: "See the measurements",
  },

  conditions: {
    inShort: "In short",
    climate: "Climate",
    water: "Water",
    soil: "Soil",
    land: "The land",
    climateLead: (p: { tempDelta: string; rainPct: string }) =>
      `Summers run ${p.tempDelta} and yearly rain is ${p.rainPct} versus the late 1990s.`,
    waterLead: (p: { grace: string; moisture: string }) =>
      `Water stored underground is ${p.grace}, and the root-zone soil is ${p.moisture}.`,
    waterLeadNoGrace: (p: { moisture: string }) =>
      `No stored-water trend here yet; the root-zone soil is ${p.moisture}.`,
    waterUnknown: "No water data for this point yet.",
    soilLead: (p: { texture: string; soc: string; ph: string; phr: string }) =>
      `${p.texture} soil. Organic carbon is ${p.soc}; pH ${p.ph} (${p.phr}).`,
    soilUnknown: "No soil data for this point — try a point on land.",
    landSteep: (p: { elevationM: string; slopePct: string }) =>
      `About ${p.elevationM} m up on a ${p.slopePct} slope — steep enough to watch for erosion.`,
    landGentle: (p: { elevationM: string; slopePct: string }) =>
      `About ${p.elevationM} m up on a gentle ${p.slopePct} slope.`,
    landUnknown: "No elevation data for this point yet.",
  },

  plan: {
    title: "Your next four years",
    subtitle: "A rotation built from your field's real climate, soil, water and terrain.",
    tuneHeading: "Priorities & crops",
    tuneHint: "Set what matters and the crops you'd consider. The plans below update live.",
    whyThisPlan: "Why this plan",
    whyThisPlanHint: "The full data → rule → decision trail behind the plan above.",
    mattersHeading: "What matters most?",
    testFutureHeading: "Test the future",
    adjustHeading: "Adjust crops & what you grow now",
    kisht: "Kisht",
    presets: {
      balanced: "Balanced",
      water: "Save water",
      soil: "Build soil",
      income: "Income",
      reliable: "Reliable",
    },
  },

  scoreWord: {
    low: "Low",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  },

  soil: {
    title: "Soil at this point",
    reading: "Reading SoilGrids…",
    unavailable: "We couldn't find farmland data here. Try a point on land.",
    error: "Soil data unavailable right now.",
    texture: "Texture",
    organicCarbon: "Organic carbon",
    ph: "pH (water)",
    source: "SoilGrids · ISRIC · 250 m",
    phRating: { acidic: "acidic", neutral: "neutral", alkaline: "alkaline" },
    nearestNote: (p: { km: number }) => `Nearest farmland soil, ${p.km} km away`,
    builtUp: "This looks like a built-up area — pick a field.",
  },

  terrain: {
    title: "Elevation & slope",
    elevation: "Elevation",
    slope: "Slope",
    source: "SRTM (AWS Terrain Tiles)",
    loading: "Reading terrain tiles…",
    unavailable: "No terrain data for this point.",
    steepNote: "Steep enough (>8%) to flag erosion risk — the plan favours cover crops.",
    flat: "flat",
    gentle: "gentle",
    steep: "steep",
  },

  soilMoisture: {
    title: "Root-zone soil moisture",
    value: "Root-zone wetness",
    sub: "mean 1995–2004 → 2015–2024",
    source: "Root-zone soil wetness · NASA POWER (MERRA-2)",
    loading: "Reading soil moisture…",
    unavailable: "No soil-moisture data for this point yet. Re-run the demo cache, or pick a live point.",
    blurbFalling:
      "Root-zone soil is drier than in 1995–2004 — the plan leans toward drought-tolerant crops.",
    blurbStable: "Root-zone soil moisture is roughly unchanged since 1995–2004.",
    blurbRising: "Root-zone soil is wetter than in 1995–2004.",
  },

  charts: {
    tempTitle: "Summer temperature by year",
    tempSub: "Mean June–August temperature, 1995–2024. Dashed line is the linear trend.",
    tempTooltipMean: "Summer mean",
    tempTooltipTrend: "Trend",
    tempYear: (p: { year: number | string }) => `Year ${p.year}`,
    rainTitle: "Rainfall by month",
    rainSub: "Average monthly precipitation, two periods side by side (mm).",
    periodBaseline: "1995–2004",
    periodRecent: "2015–2024",
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  },

  insight: {
    heading: "What this means for your field",
    heatHotter: (p: { deg: number }) =>
      `Summers are about ${p.deg} °C hotter than in the late 1990s, so heat-sensitive crops face more stress and may need earlier sowing or shade.`,
    heatCooler: (p: { deg: number }) =>
      `Summers have actually cooled by about ${p.deg} °C, which can ease heat stress but may shorten the window for heat-loving crops.`,
    heatStable:
      "Summer temperatures have stayed roughly stable (within half a degree), so heat is not the main thing changing on this field.",
    rainDown: (p: { pct: number }) =>
      `Yearly rainfall is down about ${p.pct}%, so plan for tighter water supply — favour drought-tolerant crops and efficient irrigation.`,
    rainUp: (p: { pct: number }) =>
      `Yearly rainfall is up about ${p.pct}%, which helps water supply but can raise the risk of waterlogging and fungal disease in wet months.`,
    rainStable:
      "Total yearly rainfall is roughly unchanged, so the timing of rain matters more here than the amount.",
    hotMore: (p: { n: number }) =>
      `There are now ${p.n} more very hot months (daily highs above 35 °C) per decade than before, raising the risk of heat damage at flowering.`,
    hotFewer:
      "Very hot months (daily highs above 35 °C) have become less frequent, easing peak-heat risk during the growing season.",
    soilLowCarbon:
      "Soil organic carbon here is low, so the land will benefit from legumes in the rotation and less monoculture to rebuild fertility.",
    soilAlkaline:
      "The soil is alkaline, so favour crops that tolerate high pH and watch nutrients like iron and zinc that get locked up in alkaline soils.",
    soilAcidic:
      "The soil is acidic, so lime may help and you should lean toward acid-tolerant crops.",
  },

  common: {
    source: "Source",
    pickFieldFirst: "Pick a field first",
    pickFieldHint: "Choose a point on the map so we can work out a plan for it.",
    pickFieldBtn: "Pick your field",
    loading: "Loading NASA data…",
    loadingSub: "Fetching the climate and soil record for this field.",
    error: "Couldn't load the data",
    errorSub: "Please check your connection and try again.",
    tryAgain: "Try again",
    back: "Back",
    mm: "mm",
    cachedData: "cached NASA data",
  },

  priorities: {
    title: "What matters most to you?",
    subtitle: "Set your priorities and pick the crops you'd consider. We weigh plans against this.",
    weightsHeading: "Your priorities",
    low: "Not important",
    high: "Very important",
    water: "Save water",
    waterHint: "Prefer plans with the least irrigation need.",
    soil: "Build soil",
    soilHint: "Prefer legumes, variety and cover that improve the soil.",
    income: "Income",
    incomeHint: "Prefer higher-value crops (rough relative value, not money).",
    reliability: "Reliability",
    reliabilityHint: "Prefer plans that cope with heat and dry years.",
    cropsHeading: "Crops you'd consider",
    cropsHint: "We only build rotations from crops you keep ticked. Leave them all on if unsure.",
    all: "Select all",
    none: "Clear all",
    selected: (p: { n: number; total: number }) => `${p.n} of ${p.total} crops selected`,
    tooFew: "Pick at least 4 crops so we can build a 4-year rotation.",
    continue: "See the plans →",
  },

  rotation: {
    title: "Three rotation plans",
    titleWater: "Same field. Half the thirst.",
    titleNeutral: "Same field. A smarter rotation.",
    subtitle: "Four years, built from your field's real climate, soil and water data.",
    loading: "Building plans…",
    noPlans: "No rotation fits these choices",
    noPlansSub: "Too few compatible crops, or the conditions rule most out. Add more crops in Priorities.",
    whatIfHeading: "What if?",
    whatIfHint: "Stress-test every plan against a harsher year.",
    scenarioNow: "Today's climate",
    scenarioDry: "20% less rain",
    scenarioHot: "+2 °C hotter",
    scenarioBoth: "Drier & hotter",
    match: (p: { pct: number }) => `${p.pct}% match`,
    scoreWater: "Water",
    scoreSoil: "Soil",
    scoreIncome: "Income",
    scoreReliability: "Reliability",
    seeEvidence: "See the evidence →",
    excludedHeading: (p: { n: number }) => `${p.n} crop(s) ruled out here`,
    excludedNone: "No crops were ruled out by the conditions.",
    seasonSummer: "Summer",
    seasonWinter: "Winter",
    seasonLong: "Long rains",
    seasonShort: "Short rains",
    fallow: "Fallow",
    nowHeading: "Compared with now",
    nowTitle: "Now",
    nowSub: "Your current rotation, scored the same way.",
    fewerPlansNote:
      "Water is not a constraint here, so the water-saver plan is the same as the best fit.",
  },

  current: {
    heading: "Your current rotation",
    hint: "What you grow today, so we can compare. Pick a crop for each season or leave it fallow.",
    summerLabel: "Summer crop",
    winterLabel: "Winter crop",
    fallow: "Fallow / none",
  },

  why: {
    title: "Why this advice",
    subtitle: "Every step from the field's data to the plan on the table.",
    explaining: "Explaining",
    chainHeading: "Data → rule → decision",
    colData: "What the data shows",
    colSource: "Source",
    colRule: "Rule we apply",
    colEffect: "So the plan…",
    needsHeading: "What each crop needs",
    needsCrop: "Crop",
    needsWater: "Season water",
    needsHeat: "Heat tolerance",
    needsNitrogen: "Fixes nitrogen",
    needsCaption: "Typical figures from FAO Irrigation & Drainage Papers 56 & 33. Edit for your market.",
    limitsHeading: "What Kisht does not know",
    limitPrices: "Market prices and input costs — the income figures are rough relative values, not money.",
    limitPests: "Local pests, diseases and weeds, and which seed varieties you can get.",
    limitWater: "Your water rights and what the canal or well actually delivers.",
    limitSalinity: "Soil salinity (EC) is not measured — check locally. We treat very high or low pH as a salinity risk only, not a measurement.",
    limitResolution:
      "Data is coarse: NASA POWER ~50 km, GRACE-FO ~300 km, SoilGrids 250 m. One pixel covers your field and many neighbours.",
    limitConclusion: "Treat this as a starting point and check it with a local agronomist.",
    sourcesHeading: "Data sources",
  },

  dataUsed: {
    heading: "NASA data used",
    intro: "Every number on this screen traces back to open Earth-observation data:",
    power:
      "NASA POWER (MERRA-2) — monthly temperature & rainfall and root-zone soil moisture (GWETROOT), 1995–2024.",
    grace: "GRACE-FO (NASA/JPL) — total water-storage trend, 2003–2024.",
    srtm: "SRTM via AWS Terrain Tiles — elevation & slope, for the erosion-risk rule.",
    soilgrids: "SoilGrids (ISRIC) — soil texture, organic carbon & pH (not NASA; fills the soil gap).",
    usNote:
      "US-only datasets (SSURGO, CDL, PRISM, NASS) don't cover our regions — a natural next step for US farms.",
  },

  grace: {
    cardTitle: "Water stored underground and in soil",
    caption: "GRACE-FO · total water storage · ~300 km resolution",
    loading: "Reading GRACE-FO…",
    unavailable: "No GRACE-FO value for this point yet.",
    labelFalling: "Falling",
    labelStable: "Stable",
    labelRising: "Rising",
    labelUnknown: "Unknown",
    trend: (p: { cm: number }) => `${sgn(Number(p.cm.toFixed(1)))} cm/year`,
    blurbFalling:
      "Total stored water here is dropping over 2003–2024. Plans that lean on irrigation are riskier.",
    blurbStable: "Total stored water here is roughly steady over 2003–2024.",
    blurbRising: "Total stored water here is increasing over 2003–2024.",
    blurbUnknown:
      "We don't have a GRACE-FO trend for this point yet, so the plan doesn't adjust for groundwater.",
  },

  planTitle: {
    current: "Now",
    "best-fit": "Best fit",
    "water-saver": "Water saver",
    "soil-builder": "Soil builder",
    "highest-income": "Highest income",
  },

  reliabilityLabel: {
    holds: "Holds up",
    uncertain: "Uncertain",
    "high-risk": "High risk",
  },
  reliabilityMsg: {
    holds: "Holds up in this scenario",
    uncertain: "Uncertain: water may run short",
    "high-risk": "High risk: harvest may suffer",
  },

  band: { "1": "low", "2": "medium", "3": "high" },
  socLevel: { low: "low", medium: "medium", good: "good" },
  soilMoistureTrend: { falling: "Drying", stable: "Stable", rising: "Wetter" },
  yes: "yes",
  no: "no",

  crops: {
    rice: "Rice",
    wheat: "Wheat",
    maize: "Maize",
    cotton: "Cotton",
    barley: "Barley",
    sorghum: "Sorghum",
    pearl_millet: "Pearl millet",
    soybean: "Soybean",
    chickpea: "Chickpea",
    mung_bean: "Mung bean",
    lentil: "Lentil",
    sunflower: "Sunflower",
    sesame: "Sesame",
    potato: "Potato",
    alfalfa: "Alfalfa",
  },

  reason: {
    sourceName: (s: string) => (s === "Scenario" ? "Scenario" : s),
    rain: {
      dataPoint: (p: { rainMm: number; rainChangePct: number }) =>
        `Annual rain ${p.rainMm} mm (${sgn(p.rainChangePct)}% vs 1995–2004)`,
      rule: "Match crop water demand to the rain the field actually gets",
      effectKeep: "keeps thirsty crops (e.g. rice) out of the rotation",
      effectIrrigate: (p: { crops: string }) => `relies on irrigation for ${p.crops}`,
    },
    heat: {
      dataPoint: (p: { tmaxC: number }) => `Summer max ${p.tmaxC} °C`,
      rule: "Drop crops whose heat limit sits below the growing-season max",
      effectOk: "all chosen crops stay within their heat limit",
      effectExcluded: (p: { crop: string; limit: number }) =>
        `rules out ${p.crop} (limit ${p.limit} °C)`,
    },
    soilLegume: {
      dataPoint: (p: { socPct: number }) => `Organic carbon ${p.socPct}% (low)`,
      rule: "Low-carbon soil needs a nitrogen-fixing legume in the rotation",
      effect: (p: { crop: string; year: number }) => `adds ${p.crop} in ${p.year}`,
    },
    soilDiversity: {
      dataPoint: (p: { socPct: number; socLevel: string; ph: number }) =>
        `Organic carbon ${p.socPct}% (${p.socLevel}), pH ${p.ph}`,
      rule: "Rotate plant families to break pest and disease cycles",
      effect: (p: { families: number }) => `spreads the plan across ${p.families} crop families`,
    },
    groundwater: {
      dataPoint: (p: { cm: number }) => `Water storage ${sgn(p.cm)} cm/yr`,
      rule: "Falling stored water makes irrigation-heavy plans riskier",
      effectFalling: "leans the plan away from thirsty crops",
      effectSteady: "doesn't change the plan",
    },
    erosion: {
      dataPoint: (p: { slopePct: number; elevationM: number | null }) =>
        p.elevationM == null
          ? `Slope ${p.slopePct}%`
          : `Slope ${p.slopePct}%, elevation ${p.elevationM} m`,
      rule: "Steep land (>8%) erodes under bare, back-to-back row crops",
      effectCover: "favours soil-holding cover (perennials, legumes) on the slope",
      effectRowCrops: "penalises row crops grown two years running on the slope",
    },
    soilMoisture: {
      dataPoint: (p: { baseline: number; recent: number }) =>
        `Root-zone wetness ${p.baseline.toFixed(2)} → ${p.recent.toFixed(2)} (0–1)`,
      dataPointTrend: (p: { trend: string }) => `Root-zone wetness: ${p.trend}`,
      rule: "Drying root-zone soil favours drought-tolerant crops",
      effectFalling: "raises reliability for drought-tolerant crops",
      effectSteady: "doesn't change the plan",
    },
    scenario: {
      dataPoint: (p: { parts: string }) => `What-if: ${p.parts}`,
      rainPart: (p: { pct: number }) => `${p.pct}% less rain`,
      tempPart: (p: { deg: number }) => `+${p.deg} °C`,
      rule: "Stress-test the plan against a harsher year",
      effect: "shifts the mix toward heat- and drought-tolerant crops",
    },
    whyJoin: (p: { first: string; soil: string }) =>
      `${p.first.charAt(0).toUpperCase() + p.first.slice(1)}, and it ${p.soil}.`,
  },

  sources: {
    power: {
      name: "NASA POWER",
      desc: "Monthly temperature & rainfall, 1995–2024 (~50 km).",
      url: "https://power.larc.nasa.gov/",
    },
    soilgrids: {
      name: "SoilGrids — ISRIC",
      desc: "Soil texture, organic carbon & pH at 250 m.",
      url: "https://soilgrids.org/",
    },
    grace: {
      name: "GRACE-FO — NASA/JPL (PO.DAAC)",
      desc: "Total water storage trend, 2003–2024 (~300 km).",
      url: "https://grace.jpl.nasa.gov/",
    },
    terrain: {
      name: "SRTM — AWS Terrain Tiles",
      desc: "Elevation & slope from Mapzen terrarium tiles (SRTM-based, ~30 m).",
      url: "https://registry.opendata.aws/terrain-tiles/",
    },
    fao: {
      name: "FAO Irrigation & Drainage Papers 56 / 33 / 29",
      desc: "Crop water needs, yield response & salinity tolerance.",
      url: "https://www.fao.org/land-water/databases-and-software/crop-information/en/",
    },
    osm: {
      name: "OpenStreetMap / Nominatim",
      desc: "Place search and names.",
      url: "https://www.openstreetmap.org/copyright",
    },
  },
};

export type Dict = typeof en;
export default en;

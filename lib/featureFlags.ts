export const featureFlags = {
  gedcomExporterV233: process.env.NEXT_PUBLIC_FF_GEDCOM_EXPORTER_V233 === 'true',
  readPersonNames: process.env.NEXT_PUBLIC_FF_READ_PERSON_NAMES === 'true',
  readFamilies: process.env.NEXT_PUBLIC_FF_READ_FAMILIES === 'true',
  writeFamilies: process.env.NEXT_PUBLIC_FF_WRITE_FAMILIES === 'true',

  readEvents: process.env.NEXT_PUBLIC_FF_READ_EVENTS === 'true',
  writeEvents: process.env.NEXT_PUBLIC_FF_WRITE_EVENTS === 'true',

  vietnameseTreeLayout: process.env.NEXT_PUBLIC_FF_VIETNAMESE_TREE_LAYOUT === 'true',
  rootStats: process.env.NEXT_PUBLIC_FF_ROOT_STATS === 'true',
  maternalPaternalView: process.env.NEXT_PUBLIC_FF_MATERNAL_PATERNAL_VIEW === 'true',

  gedcomImportStaging: process.env.NEXT_PUBLIC_FF_GEDCOM_IMPORT_STAGING === 'true',
  allowLegacyCleanup: process.env.NEXT_PUBLIC_FF_ALLOW_LEGACY_CLEANUP === 'true',
};
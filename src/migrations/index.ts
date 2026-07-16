import * as migration_20260324_054022 from './20260324_054022';
import * as migration_20260324_075120 from './20260324_075120';
import * as migration_20260324_082047 from './20260324_082047';
import * as migration_20260324_100000 from './20260324_100000';
import * as migration_20260331_categories_dynamiques from './20260331_categories_dynamiques';
import * as migration_20260408_025524 from './20260408_025524';
import * as migration_20260408_034241 from './20260408_034241';
import * as migration_20260408_075322 from './20260408_075322';
import * as migration_20260408_120000_photos_refactor from './20260408_120000_photos_refactor';
import * as migration_20260411_053500_plan_groupes from './20260411_053500_plan_groupes';
import * as migration_20260411_070000_drop_legacy_columns from './20260411_070000_drop_legacy_columns';
import * as migration_20260415_043059_add_visible_evenements from './20260415_043059_add_visible_evenements';
import * as migration_20260415_090710_add_reseaux_sociaux from './20260415_090710_add_reseaux_sociaux';
import * as migration_20260415_105837_organisateur_upgrade from './20260415_105837_organisateur_upgrade';
import * as migration_20260415_120000_add_video_youtube from './20260415_120000_add_video_youtube';
import * as migration_20260416_093556_add_labels_rse from './20260416_093556_add_labels_rse';
import * as migration_20260416_100141_drop_labels_rse_logo_not_null from './20260416_100141_drop_labels_rse_logo_not_null';
import * as migration_20260416_120000_align_statut_enums from './20260416_120000_align_statut_enums';
import * as migration_20260417_035701_add_testimonials from './20260417_035701_add_testimonials';
import * as migration_20260417_105316_add_onboarding_emails from './20260417_105316_add_onboarding_emails';
import * as migration_20260417_180000_add_consent_billing_fields from './20260417_180000_add_consent_billing_fields';
import * as migration_20260417_190000_add_audit_logs from './20260417_190000_add_audit_logs';
import * as migration_20260418_100000_fournisseurs_user_unique from './20260418_100000_fournisseurs_user_unique';
import * as migration_20260418_161349_add_email_blacklist_fields from './20260418_161349_add_email_blacklist_fields';
import * as migration_20260418_200000_add_stripe_events from './20260418_200000_add_stripe_events';
import * as migration_20260419_070000_fiches_orphelines from './20260419_070000_fiches_orphelines';
import * as migration_20260420_100000_add_expiration_alerts_flags from './20260420_100000_add_expiration_alerts_flags';
import * as migration_20260420_103000_audit_logs_add_stripe_misconfig from './20260420_103000_audit_logs_add_stripe_misconfig';
import * as migration_20260420_110000_audit_logs_add_groupe_sync_failed from './20260420_110000_audit_logs_add_groupe_sync_failed';
import * as migration_20260420_120000_audit_logs_add_plan_changed from './20260420_120000_audit_logs_add_plan_changed';
import * as migration_20260420_130000_groupes_soft_delete from './20260420_130000_groupes_soft_delete';
import * as migration_20260420_140000_add_seo_group from './20260420_140000_add_seo_group';
import * as migration_20260423_110541_add_slug_evenements from './20260423_110541_add_slug_evenements';
import * as migration_20260423_150000_add_pending_email_fields from './20260423_150000_add_pending_email_fields';
import * as migration_20260424_080000_backfill_expiration_alerts from './20260424_080000_backfill_expiration_alerts';
import * as migration_20260426_100000_audit_logs_add_groupe_lifecycle from './20260426_100000_audit_logs_add_groupe_lifecycle';
import * as migration_20260426_110000_add_pending_groupe_code from './20260426_110000_add_pending_groupe_code';
import * as migration_20260426_200000_add_geo_indexes from './20260426_200000_add_geo_indexes';
import * as migration_20260427_120000_add_exclude_from_onboarding from './20260427_120000_add_exclude_from_onboarding';
import * as migration_20260427_120100_audit_logs_add_email_blacklisted from './20260427_120100_audit_logs_add_email_blacklisted';
import * as migration_20260616_120000_add_offres_emploi from './20260616_120000_add_offres_emploi';
import * as migration_20260623_100000_postgis_extension from './20260623_100000_postgis_extension';
import * as migration_20260623_110000_create_reseaux from './20260623_110000_create_reseaux';
import * as migration_20260623_120000_data_migration_fusion from './20260623_120000_data_migration_fusion';
import * as migration_20260623_130000_plan_enum_et_categories from './20260623_130000_plan_enum_et_categories';
// ── ADR-0011 : modèle à 3 entités
import * as migration_20260628_100000_reseauteurs from './20260628_100000_reseauteurs';
import * as migration_20260628_110000_partenaires from './20260628_110000_partenaires';
import * as migration_20260628_120000_badges from './20260628_120000_badges';
import * as migration_20260628_130000_categories from './20260628_130000_categories';
import * as migration_20260628_140000_reseaux_adapter from './20260628_140000_reseaux_adapter';
import * as migration_20260628_150000_evenements_adapter from './20260628_150000_evenements_adapter';
import * as migration_20260628_160000_users_roles from './20260628_160000_users_roles';
import * as migration_20260628_170000_indexes from './20260628_170000_indexes';
import * as migration_20260629_100000_evenements_description_compat from './20260629_100000_evenements_description_compat';
import * as migration_20260629_101000_evenements_image_compat from './20260629_101000_evenements_image_compat';
import * as migration_20260629_102000_partenaires_stripe_customer from './20260629_102000_partenaires_stripe_customer';
// ── ADR-0012 — hiérarchie réseaux national↔local (E1 — 2026-06-30)
import * as migration_20260630_100000_reseaux_hierarchie from './20260630_100000_reseaux_hierarchie';
import * as migration_20260630_110000_evenements_drop_premium from './20260630_110000_evenements_drop_premium';
import * as migration_20260630_120000_reseaux_niveau_national_default from './20260630_120000_reseaux_niveau_national_default';
// ── Correctif inscription — restaure le DEFAULT de users.plan (2026-07-07)
import * as migration_20260707_100000_users_plan_default from './20260707_100000_users_plan_default';
// ── Correctif deadlock geom — triggers BEFORE INSERT/UPDATE (2026-07-08)
import * as migration_20260708_100000_geom_triggers from './20260708_100000_geom_triggers';
// ── Participation réseauteur ↔ événement (M2M) (2026-07-09)
import * as migration_20260709_100000_reseauteurs_participation from './20260709_100000_reseauteurs_participation';
// ── Partenaires self-service : rôle partenaire + fiche + offre (2026-07-10)
import * as migration_20260710_100000_partenaires_self_service from './20260710_100000_partenaires_self_service';
// ── ADR-0013 P1 : Réseauteur Plus + packs de licences (2026-07-12)
import * as migration_20260712_100000_reseauteur_plus_licences from './20260712_100000_reseauteur_plus_licences';
// ── Slug réseauteur = prénom-nom : slug nullable pour les squelettes (2026-07-12)
import * as migration_20260712_110000_reseauteurs_slug_nullable from './20260712_110000_reseauteurs_slug_nullable';
// ── ADR-0013 §3bis : inscriptions aux événements Plus (2026-07-13)
import * as migration_20260713_100000_inscriptions from './20260713_100000_inscriptions';
// ── Fiche réseau complète : responsable, fonctionnement, type/portée… (2026-07-13)
import * as migration_20260713_110000_reseaux_fiche_complete from './20260713_110000_reseaux_fiche_complete';
// ── niveau à 4 valeurs (fusion portee) — tête→chapitres conservé (2026-07-13)
import * as migration_20260713_120000_niveau_4_valeurs from './20260713_120000_niveau_4_valeurs';
// ── Fiche événement complète : participation, contact, catégorisation, médias… (2026-07-13)
import * as migration_20260713_130000_evenements_fiche_complete from './20260713_130000_evenements_fiche_complete';
// ── Filtre par département sur les événements (2026-07-13)
import * as migration_20260713_140000_evenements_departement from './20260713_140000_evenements_departement';
// ── Index de performance (audit 2026-07-14)
import * as migration_20260714_100000_perf_indexes from './20260714_100000_perf_indexes';
// ── Admin de groupe (réseauteur Plus) : ownership créateur des événements (2026-07-16)
import * as migration_20260716_100000_evenements_cree_par_user from './20260716_100000_evenements_cree_par_user';

export const migrations = [
  {
    up: migration_20260324_054022.up,
    down: migration_20260324_054022.down,
    name: '20260324_054022',
  },
  {
    up: migration_20260324_075120.up,
    down: migration_20260324_075120.down,
    name: '20260324_075120',
  },
  {
    up: migration_20260324_082047.up,
    down: migration_20260324_082047.down,
    name: '20260324_082047',
  },
  {
    up: migration_20260324_100000.up,
    down: migration_20260324_100000.down,
    name: '20260324_100000',
  },
  {
    up: migration_20260331_categories_dynamiques.up,
    down: migration_20260331_categories_dynamiques.down,
    name: '20260331_categories_dynamiques',
  },
  {
    up: migration_20260408_025524.up,
    down: migration_20260408_025524.down,
    name: '20260408_025524',
  },
  {
    up: migration_20260408_034241.up,
    down: migration_20260408_034241.down,
    name: '20260408_034241',
  },
  {
    up: migration_20260408_075322.up,
    down: migration_20260408_075322.down,
    name: '20260408_075322',
  },
  {
    up: migration_20260408_120000_photos_refactor.up,
    down: migration_20260408_120000_photos_refactor.down,
    name: '20260408_120000_photos_refactor',
  },
  {
    up: migration_20260411_053500_plan_groupes.up,
    down: migration_20260411_053500_plan_groupes.down,
    name: '20260411_053500_plan_groupes',
  },
  {
    up: migration_20260411_070000_drop_legacy_columns.up,
    down: migration_20260411_070000_drop_legacy_columns.down,
    name: '20260411_070000_drop_legacy_columns',
  },
  {
    up: migration_20260415_043059_add_visible_evenements.up,
    down: migration_20260415_043059_add_visible_evenements.down,
    name: '20260415_043059_add_visible_evenements',
  },
  {
    up: migration_20260415_090710_add_reseaux_sociaux.up,
    down: migration_20260415_090710_add_reseaux_sociaux.down,
    name: '20260415_090710_add_reseaux_sociaux',
  },
  {
    up: migration_20260415_105837_organisateur_upgrade.up,
    down: migration_20260415_105837_organisateur_upgrade.down,
    name: '20260415_105837_organisateur_upgrade',
  },
  {
    up: migration_20260415_120000_add_video_youtube.up,
    down: migration_20260415_120000_add_video_youtube.down,
    name: '20260415_120000_add_video_youtube',
  },
  {
    up: migration_20260416_093556_add_labels_rse.up,
    down: migration_20260416_093556_add_labels_rse.down,
    name: '20260416_093556_add_labels_rse',
  },
  {
    up: migration_20260416_100141_drop_labels_rse_logo_not_null.up,
    down: migration_20260416_100141_drop_labels_rse_logo_not_null.down,
    name: '20260416_100141_drop_labels_rse_logo_not_null',
  },
  {
    up: migration_20260416_120000_align_statut_enums.up,
    down: migration_20260416_120000_align_statut_enums.down,
    name: '20260416_120000_align_statut_enums',
  },
  {
    up: migration_20260417_035701_add_testimonials.up,
    down: migration_20260417_035701_add_testimonials.down,
    name: '20260417_035701_add_testimonials',
  },
  {
    up: migration_20260417_105316_add_onboarding_emails.up,
    down: migration_20260417_105316_add_onboarding_emails.down,
    name: '20260417_105316_add_onboarding_emails',
  },
  {
    up: migration_20260417_180000_add_consent_billing_fields.up,
    down: migration_20260417_180000_add_consent_billing_fields.down,
    name: '20260417_180000_add_consent_billing_fields',
  },
  {
    up: migration_20260417_190000_add_audit_logs.up,
    down: migration_20260417_190000_add_audit_logs.down,
    name: '20260417_190000_add_audit_logs',
  },
  {
    up: migration_20260418_100000_fournisseurs_user_unique.up,
    down: migration_20260418_100000_fournisseurs_user_unique.down,
    name: '20260418_100000_fournisseurs_user_unique',
  },
  {
    up: migration_20260418_161349_add_email_blacklist_fields.up,
    down: migration_20260418_161349_add_email_blacklist_fields.down,
    name: '20260418_161349_add_email_blacklist_fields',
  },
  {
    up: migration_20260418_200000_add_stripe_events.up,
    down: migration_20260418_200000_add_stripe_events.down,
    name: '20260418_200000_add_stripe_events',
  },
  {
    up: migration_20260419_070000_fiches_orphelines.up,
    down: migration_20260419_070000_fiches_orphelines.down,
    name: '20260419_070000_fiches_orphelines',
  },
  {
    up: migration_20260420_100000_add_expiration_alerts_flags.up,
    down: migration_20260420_100000_add_expiration_alerts_flags.down,
    name: '20260420_100000_add_expiration_alerts_flags',
  },
  {
    up: migration_20260420_103000_audit_logs_add_stripe_misconfig.up,
    down: migration_20260420_103000_audit_logs_add_stripe_misconfig.down,
    name: '20260420_103000_audit_logs_add_stripe_misconfig',
  },
  {
    up: migration_20260420_110000_audit_logs_add_groupe_sync_failed.up,
    down: migration_20260420_110000_audit_logs_add_groupe_sync_failed.down,
    name: '20260420_110000_audit_logs_add_groupe_sync_failed',
  },
  {
    up: migration_20260420_120000_audit_logs_add_plan_changed.up,
    down: migration_20260420_120000_audit_logs_add_plan_changed.down,
    name: '20260420_120000_audit_logs_add_plan_changed',
  },
  {
    up: migration_20260420_130000_groupes_soft_delete.up,
    down: migration_20260420_130000_groupes_soft_delete.down,
    name: '20260420_130000_groupes_soft_delete',
  },
  {
    up: migration_20260420_140000_add_seo_group.up,
    down: migration_20260420_140000_add_seo_group.down,
    name: '20260420_140000_add_seo_group',
  },
  {
    up: migration_20260423_110541_add_slug_evenements.up,
    down: migration_20260423_110541_add_slug_evenements.down,
    name: '20260423_110541_add_slug_evenements',
  },
  {
    up: migration_20260423_150000_add_pending_email_fields.up,
    down: migration_20260423_150000_add_pending_email_fields.down,
    name: '20260423_150000_add_pending_email_fields',
  },
  {
    up: migration_20260424_080000_backfill_expiration_alerts.up,
    down: migration_20260424_080000_backfill_expiration_alerts.down,
    name: '20260424_080000_backfill_expiration_alerts',
  },
  {
    up: migration_20260426_100000_audit_logs_add_groupe_lifecycle.up,
    down: migration_20260426_100000_audit_logs_add_groupe_lifecycle.down,
    name: '20260426_100000_audit_logs_add_groupe_lifecycle',
  },
  {
    up: migration_20260426_110000_add_pending_groupe_code.up,
    down: migration_20260426_110000_add_pending_groupe_code.down,
    name: '20260426_110000_add_pending_groupe_code',
  },
  {
    up: migration_20260426_200000_add_geo_indexes.up,
    down: migration_20260426_200000_add_geo_indexes.down,
    name: '20260426_200000_add_geo_indexes',
  },
  {
    up: migration_20260427_120000_add_exclude_from_onboarding.up,
    down: migration_20260427_120000_add_exclude_from_onboarding.down,
    name: '20260427_120000_add_exclude_from_onboarding',
  },
  {
    up: migration_20260427_120100_audit_logs_add_email_blacklisted.up,
    down: migration_20260427_120100_audit_logs_add_email_blacklisted.down,
    name: '20260427_120100_audit_logs_add_email_blacklisted',
  },
  {
    up: migration_20260616_120000_add_offres_emploi.up,
    down: migration_20260616_120000_add_offres_emploi.down,
    name: '20260616_120000_add_offres_emploi',
  },
  {
    up: migration_20260623_100000_postgis_extension.up,
    down: migration_20260623_100000_postgis_extension.down,
    name: '20260623_100000_postgis_extension',
  },
  {
    up: migration_20260623_110000_create_reseaux.up,
    down: migration_20260623_110000_create_reseaux.down,
    name: '20260623_110000_create_reseaux',
  },
  {
    up: migration_20260623_120000_data_migration_fusion.up,
    down: migration_20260623_120000_data_migration_fusion.down,
    name: '20260623_120000_data_migration_fusion',
  },
  {
    up: migration_20260623_130000_plan_enum_et_categories.up,
    down: migration_20260623_130000_plan_enum_et_categories.down,
    name: '20260623_130000_plan_enum_et_categories',
  },
  // ── ADR-0011 — modèle 3 entités (2026-06-28)
  // Ordre d'application : 100000 (reseauteurs) doit suivre 130000 (categories)
  {
    up: migration_20260628_130000_categories.up,
    down: migration_20260628_130000_categories.down,
    name: '20260628_130000_categories',
  },
  {
    up: migration_20260628_100000_reseauteurs.up,
    down: migration_20260628_100000_reseauteurs.down,
    name: '20260628_100000_reseauteurs',
  },
  {
    up: migration_20260628_110000_partenaires.up,
    down: migration_20260628_110000_partenaires.down,
    name: '20260628_110000_partenaires',
  },
  {
    up: migration_20260628_120000_badges.up,
    down: migration_20260628_120000_badges.down,
    name: '20260628_120000_badges',
  },
  {
    up: migration_20260628_140000_reseaux_adapter.up,
    down: migration_20260628_140000_reseaux_adapter.down,
    name: '20260628_140000_reseaux_adapter',
  },
  {
    up: migration_20260628_150000_evenements_adapter.up,
    down: migration_20260628_150000_evenements_adapter.down,
    name: '20260628_150000_evenements_adapter',
  },
  {
    up: migration_20260628_160000_users_roles.up,
    down: migration_20260628_160000_users_roles.down,
    name: '20260628_160000_users_roles',
  },
  {
    up: migration_20260628_170000_indexes.up,
    down: migration_20260628_170000_indexes.down,
    name: '20260628_170000_indexes',
  },
  {
    up: migration_20260629_100000_evenements_description_compat.up,
    down: migration_20260629_100000_evenements_description_compat.down,
    name: '20260629_100000_evenements_description_compat',
  },
  {
    up: migration_20260629_101000_evenements_image_compat.up,
    down: migration_20260629_101000_evenements_image_compat.down,
    name: '20260629_101000_evenements_image_compat',
  },
  {
    up: migration_20260629_102000_partenaires_stripe_customer.up,
    down: migration_20260629_102000_partenaires_stripe_customer.down,
    name: '20260629_102000_partenaires_stripe_customer',
  },
  // ── ADR-0012 — Jalon E1 (hiérarchie réseaux national↔local, drop Premium)
  {
    up: migration_20260630_100000_reseaux_hierarchie.up,
    down: migration_20260630_100000_reseaux_hierarchie.down,
    name: '20260630_100000_reseaux_hierarchie',
  },
  {
    up: migration_20260630_110000_evenements_drop_premium.up,
    down: migration_20260630_110000_evenements_drop_premium.down,
    name: '20260630_110000_evenements_drop_premium',
  },
  {
    up: migration_20260630_120000_reseaux_niveau_national_default.up,
    down: migration_20260630_120000_reseaux_niveau_national_default.down,
    name: '20260630_120000_reseaux_niveau_national_default',
  },
  {
    up: migration_20260707_100000_users_plan_default.up,
    down: migration_20260707_100000_users_plan_default.down,
    name: '20260707_100000_users_plan_default',
  },
  {
    up: migration_20260708_100000_geom_triggers.up,
    down: migration_20260708_100000_geom_triggers.down,
    name: '20260708_100000_geom_triggers',
  },
  {
    up: migration_20260709_100000_reseauteurs_participation.up,
    down: migration_20260709_100000_reseauteurs_participation.down,
    name: '20260709_100000_reseauteurs_participation',
  },
  {
    up: migration_20260710_100000_partenaires_self_service.up,
    down: migration_20260710_100000_partenaires_self_service.down,
    name: '20260710_100000_partenaires_self_service',
  },
  {
    up: migration_20260712_100000_reseauteur_plus_licences.up,
    down: migration_20260712_100000_reseauteur_plus_licences.down,
    name: '20260712_100000_reseauteur_plus_licences',
  },
  {
    up: migration_20260712_110000_reseauteurs_slug_nullable.up,
    down: migration_20260712_110000_reseauteurs_slug_nullable.down,
    name: '20260712_110000_reseauteurs_slug_nullable',
  },
  {
    up: migration_20260713_100000_inscriptions.up,
    down: migration_20260713_100000_inscriptions.down,
    name: '20260713_100000_inscriptions',
  },
  {
    up: migration_20260713_110000_reseaux_fiche_complete.up,
    down: migration_20260713_110000_reseaux_fiche_complete.down,
    name: '20260713_110000_reseaux_fiche_complete',
  },
  {
    up: migration_20260713_120000_niveau_4_valeurs.up,
    down: migration_20260713_120000_niveau_4_valeurs.down,
    name: '20260713_120000_niveau_4_valeurs',
  },
  {
    up: migration_20260713_130000_evenements_fiche_complete.up,
    down: migration_20260713_130000_evenements_fiche_complete.down,
    name: '20260713_130000_evenements_fiche_complete',
  },
  {
    up: migration_20260713_140000_evenements_departement.up,
    down: migration_20260713_140000_evenements_departement.down,
    name: '20260713_140000_evenements_departement',
  },
  {
    up: migration_20260714_100000_perf_indexes.up,
    down: migration_20260714_100000_perf_indexes.down,
    name: '20260714_100000_perf_indexes',
  },
  {
    up: migration_20260716_100000_evenements_cree_par_user.up,
    down: migration_20260716_100000_evenements_cree_par_user.down,
    name: '20260716_100000_evenements_cree_par_user',
  },
];

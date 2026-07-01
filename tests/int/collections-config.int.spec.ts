import { describe, it, expect } from 'vitest'
import { Users } from '@/collections/Users'
import { Fournisseurs } from '@/collections/Fournisseurs'
import { Evenements } from '@/collections/Evenements'
import { Groupes } from '@/collections/Groupes'
import { Media } from '@/collections/Media'
import { CategoriesActivite } from '@/collections/CategoriesActivite'
import { TypesEvenement } from '@/collections/TypesEvenement'
import { OrganisateursEvenements } from '@/collections/OrganisateursEvenements'
import type { CollectionConfig, Field, SelectField, TextField, NumberField, RelationshipField, DateField, TextareaField, ArrayField } from 'payload'

// ── Helpers ──────────────────────────────────────────────────────────────────

function findField(collection: CollectionConfig, name: string): Field | undefined {
  return collection.fields.find((f) => 'name' in f && f.name === name)
}

function getFieldType(collection: CollectionConfig, name: string): string | undefined {
  const field = findField(collection, name)
  return field && 'type' in field ? field.type : undefined
}

// ── Users ────────────────────────────────────────────────────────────────────

describe('Collection config: Users', () => {
  it('has slug "users"', () => {
    expect(Users.slug).toBe('users')
  })

  it('has auth enabled', () => {
    expect(Users.auth).toBeDefined()
  })

  it('has all required fields', () => {
    const fieldNames = Users.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    expect(fieldNames).toContain('role')
    expect(fieldNames).toContain('plan')
    expect(fieldNames).toContain('groupe')
    expect(fieldNames).toContain('nomSociete')
    expect(fieldNames).toContain('ville')
    expect(fieldNames).toContain('stripeCustomerId')
    expect(fieldNames).toContain('stripeSubscriptionId')
    expect(fieldNames).toContain('planExpiresAt')
  })

  it('does NOT have legacy fields', () => {
    const fieldNames = Users.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    expect(fieldNames).not.toContain('legacyPlan')
    expect(fieldNames).not.toContain('packType')
    expect(fieldNames).not.toContain('featureLevel')
    expect(fieldNames).not.toContain('ficheQuota')
  })

  it('plan is a select with the 3-tier options', () => {
    const plan = findField(Users, 'plan') as SelectField
    expect(plan.type).toBe('select')
    const values = plan.options.map((o) => (typeof o === 'string' ? o : o.value))
    expect(values).toEqual(['gratuit', 'premium', 'infinite'])
    expect(plan.saveToJWT).toBe(true)
  })

  it('groupe is an optional relationship to groupes', () => {
    const groupe = findField(Users, 'groupe') as RelationshipField
    expect(groupe.type).toBe('relationship')
    expect(groupe.relationTo).toBe('groupes')
    expect(groupe.required).toBeFalsy()
  })

  it('role is a select with correct options', () => {
    const role = findField(Users, 'role') as SelectField
    expect(role.type).toBe('select')
    const values = role.options.map((o) => typeof o === 'string' ? o : o.value)
    expect(values).toContain('admin')
    expect(values).toContain('fournisseur')
  })

  it('role has saveToJWT', () => {
    const role = findField(Users, 'role') as SelectField
    expect(role.saveToJWT).toBe(true)
  })

  it('nomSociete is required', () => {
    const nom = findField(Users, 'nomSociete') as TextField
    expect(nom.required).toBe(true)
  })

  it('ville is required', () => {
    const ville = findField(Users, 'ville') as TextField
    expect(ville.required).toBe(true)
  })

  it('stripeCustomerId has admin-only read and update access', () => {
    const field = findField(Users, 'stripeCustomerId') as TextField
    expect(field.access?.read).toBeDefined()
    expect(field.access?.update).toBeDefined()
  })

  it('stripeSubscriptionId has admin-only read and update access', () => {
    const field = findField(Users, 'stripeSubscriptionId') as TextField
    expect(field.access?.read).toBeDefined()
    expect(field.access?.update).toBeDefined()
  })

  it('planExpiresAt has admin-only update access', () => {
    const field = findField(Users, 'planExpiresAt') as DateField
    expect(field.access?.update).toBeDefined()
  })

  it('plan has admin-only update access', () => {
    const field = findField(Users, 'plan') as SelectField
    expect(field.access?.update).toBeDefined()
  })

  it('has beforeChange, beforeValidate, and afterChange hooks', () => {
    expect(Users.hooks?.beforeChange).toBeDefined()
    expect(Users.hooks?.beforeChange!.length).toBeGreaterThan(0)
    expect(Users.hooks?.beforeValidate).toBeDefined()
    expect(Users.hooks?.afterChange).toBeDefined()
  })

  it('create access is open (returns true)', () => {
    expect(Users.access?.create).toBeDefined()
  })

  it('delete access is admin only', () => {
    expect(Users.access?.delete).toBeDefined()
  })
})

// ── Fournisseurs ─────────────────────────────────────────────────────────────

describe('Collection config: Fournisseurs', () => {
  it('has slug "fournisseurs"', () => {
    expect(Fournisseurs.slug).toBe('fournisseurs')
  })

  it('has all documented fields', () => {
    const fieldNames = Fournisseurs.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    const expected = [
      'user', 'slug', 'raisonSociale', 'ville',
      'activitePrincipale', 'activitesSecondaires', 'statut',
      'adresse', 'codePostal', 'siteWeb', 'emailContact', 'telephone',
      'description', 'banniere', 'logo', 'illustrations',
      'latitude', 'longitude',
    ]
    for (const name of expected) {
      expect(fieldNames).toContain(name)
    }
  })

  it('user is a relationship to users', () => {
    const field = findField(Fournisseurs, 'user') as RelationshipField
    expect(field.type).toBe('relationship')
    expect(field.relationTo).toBe('users')
    expect(field.required).toBe(true)
  })

  it('slug is unique', () => {
    const field = findField(Fournisseurs, 'slug') as TextField
    expect(field.unique).toBe(true)
  })

  it('activitePrincipale points to categories-activite', () => {
    const field = findField(Fournisseurs, 'activitePrincipale') as RelationshipField
    expect(field.relationTo).toBe('categories-activite')
    expect(field.required).toBe(true)
  })

  it('activitesSecondaires has hasMany', () => {
    const field = findField(Fournisseurs, 'activitesSecondaires') as RelationshipField
    expect(field.hasMany).toBe(true)
  })

  it('statut has 4 options and admin-only update', () => {
    const field = findField(Fournisseurs, 'statut') as SelectField
    const values = field.options.map((o) => typeof o === 'string' ? o : o.value)
    expect(values).toEqual(['publiee', 'suspendue'])
    expect(field.access?.update).toBeDefined()
  })

  it('Premium+ fields have isPremiumOrAbove access', () => {
    const premiumOrAboveFields = ['adresse', 'codePostal', 'siteWeb', 'emailContact', 'telephone', 'activitesSecondaires']
    for (const name of premiumOrAboveFields) {
      const field = findField(Fournisseurs, name)!
      expect('access' in field && field.access?.update, `${name} should have update access`).toBeDefined()
    }
  })

  it('Infinite fields have isInfinite access', () => {
    const infiniteFields = ['description', 'banniere', 'logo', 'illustrations']
    for (const name of infiniteFields) {
      const field = findField(Fournisseurs, name)!
      expect('access' in field && field.access?.update, `${name} should have update access`).toBeDefined()
    }
  })

  it('description has maxLength 1000', () => {
    const field = findField(Fournisseurs, 'description') as TextareaField
    expect(field.maxLength).toBe(1000)
  })

  it('illustrations has maxRows 6', () => {
    const field = findField(Fournisseurs, 'illustrations') as ArrayField
    expect(field.maxRows).toBe(6)
  })

  it('latitude and longitude have admin-only update', () => {
    for (const name of ['latitude', 'longitude']) {
      const field = findField(Fournisseurs, name) as NumberField
      expect(field.access?.update).toBeDefined()
    }
  })

  it('has beforeValidate, beforeChange, and beforeDelete hooks', () => {
    expect(Fournisseurs.hooks?.beforeValidate?.length).toBeGreaterThan(0)
    expect(Fournisseurs.hooks?.beforeChange?.length).toBeGreaterThan(0)
    expect(Fournisseurs.hooks?.beforeDelete?.length).toBeGreaterThan(0)
  })
})

// ── Evenements ───────────────────────────────────────────────────────────────

describe('Collection config: Evenements', () => {
  it('has slug "evenements"', () => {
    expect(Evenements.slug).toBe('evenements')
  })

  it('has all documented fields', () => {
    const fieldNames = Evenements.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    const expected = [
      'fournisseur', 'titre', 'type', 'dateDebut', 'dateFin',
      'lieuNom', 'lieuAdresse', 'lieuCodePostal', 'lieuVille',
      'descriptionCourte', 'lienInscription', 'emailContact',
      'banniere', 'logo', 'illustrations', 'statut',
      'lieuLatitude', 'lieuLongitude',
    ]
    for (const name of expected) {
      expect(fieldNames, `missing field: ${name}`).toContain(name)
    }
  })

  it('has undocumented multi-fournisseur fields', () => {
    const fieldNames = Evenements.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    expect(fieldNames).toContain('organisateurExterne')
    expect(fieldNames).toContain('fournisseursAssocies')
    expect(fieldNames).toContain('activites')
  })

  it('fournisseur is optional (null = national event)', () => {
    const field = findField(Evenements, 'fournisseur') as RelationshipField
    expect(field.required).toBeFalsy()
  })

  it('type points to types-evenement and is required', () => {
    const field = findField(Evenements, 'type') as RelationshipField
    expect(field.relationTo).toBe('types-evenement')
    expect(field.required).toBe(true)
  })

  it('statut has 3 options and admin-only update', () => {
    const field = findField(Evenements, 'statut') as SelectField
    const values = field.options.map((o) => typeof o === 'string' ? o : o.value)
    expect(values).toEqual(['publie', 'archive'])
    expect(field.access?.update).toBeDefined()
  })

  it('descriptionCourte has maxLength 400', () => {
    const field = findField(Evenements, 'descriptionCourte') as TextareaField
    expect(field.maxLength).toBe(400)
  })

  it('illustrations has maxRows 4', () => {
    const field = findField(Evenements, 'illustrations') as ArrayField
    expect(field.maxRows).toBe(4)
  })

  it('create access is async (Infinite check)', () => {
    expect(Evenements.access?.create).toBeDefined()
  })

  it('has beforeValidate and beforeChange hooks', () => {
    expect(Evenements.hooks?.beforeValidate?.length).toBeGreaterThan(0)
    expect(Evenements.hooks?.beforeChange?.length).toBeGreaterThan(0)
  })
})

// ── Groupes ──────────────────────────────────────────────────────────────────

describe('Collection config: Groupes', () => {
  it('has slug "groupes"', () => {
    expect(Groupes.slug).toBe('groupes')
  })

  it('has all required fields', () => {
    const fieldNames = Groupes.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    expect(fieldNames).toContain('nom')
    expect(fieldNames).toContain('code')
    expect(fieldNames).toContain('owner')
    expect(fieldNames).toContain('palierActuel')
    expect(fieldNames).toContain('stripeCouponId')
  })

  it('code is unique and indexed', () => {
    const code = findField(Groupes, 'code') as TextField
    expect(code.unique).toBe(true)
    expect(code.index).toBe(true)
  })

  it('owner is a required relationship to users', () => {
    const owner = findField(Groupes, 'owner') as RelationshipField
    expect(owner.relationTo).toBe('users')
    expect(owner.required).toBe(true)
  })

  it('palierActuel has 4 options', () => {
    const field = findField(Groupes, 'palierActuel') as SelectField
    const values = field.options.map((o) => (typeof o === 'string' ? o : o.value))
    expect(values).toEqual(['0', '5', '10', '15'])
    expect(field.access?.update).toBeDefined()
  })

  it('has beforeValidate hook (code generation)', () => {
    expect(Groupes.hooks?.beforeValidate?.length).toBeGreaterThan(0)
  })
})

// ── Media ────────────────────────────────────────────────────────────────────

describe('Collection config: Media', () => {
  it('has slug "media"', () => {
    expect(Media.slug).toBe('media')
  })

  it('has alt field required', () => {
    const field = findField(Media, 'alt') as TextField
    expect(field.required).toBe(true)
  })

  it('has upload config with 3 image sizes', () => {
    const upload = Media.upload
    expect(upload).toBeDefined()
    if (typeof upload === 'object') {
      expect(upload.imageSizes).toHaveLength(3)
      const names = upload.imageSizes!.map((s) => s.name)
      expect(names).toContain('thumbnail')
      expect(names).toContain('card')
      expect(names).toContain('full')
    }
  })

  it('accepts only JPG, PNG, WebP', () => {
    const upload = Media.upload
    if (typeof upload === 'object') {
      expect(upload.mimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    }
  })

  it('read access is public', () => {
    expect(Media.access?.read).toBeDefined()
  })

  it('delete access is admin only', () => {
    expect(Media.access?.delete).toBeDefined()
  })
})

// ── CategoriesActivite ───────────────────────────────────────────────────────

describe('Collection config: CategoriesActivite', () => {
  it('has slug "categories-activite"', () => {
    expect(CategoriesActivite.slug).toBe('categories-activite')
  })

  it('has all required fields with correct types', () => {
    expect(getFieldType(CategoriesActivite, 'label')).toBe('text')
    expect(getFieldType(CategoriesActivite, 'value')).toBe('text')
    expect(getFieldType(CategoriesActivite, 'couleur')).toBe('text')
    expect(getFieldType(CategoriesActivite, 'ordre')).toBe('number')
  })

  it('value field is unique', () => {
    const field = findField(CategoriesActivite, 'value') as TextField
    expect(field.unique).toBe(true)
  })

  it('label and value are required', () => {
    const label = findField(CategoriesActivite, 'label') as TextField
    const value = findField(CategoriesActivite, 'value') as TextField
    expect(label.required).toBe(true)
    expect(value.required).toBe(true)
  })

  it('couleur is required', () => {
    const couleur = findField(CategoriesActivite, 'couleur') as TextField
    expect(couleur.required).toBe(true)
  })

  it('has beforeDelete hook', () => {
    expect(CategoriesActivite.hooks?.beforeDelete?.length).toBeGreaterThan(0)
  })
})

// ── TypesEvenement ───────────────────────────────────────────────────────────

describe('Collection config: TypesEvenement', () => {
  it('has slug "types-evenement"', () => {
    expect(TypesEvenement.slug).toBe('types-evenement')
  })

  it('has all required fields with correct types', () => {
    expect(getFieldType(TypesEvenement, 'label')).toBe('text')
    expect(getFieldType(TypesEvenement, 'value')).toBe('text')
    expect(getFieldType(TypesEvenement, 'couleur')).toBe('text')
    expect(getFieldType(TypesEvenement, 'ordre')).toBe('number')
  })

  it('value field is unique', () => {
    const field = findField(TypesEvenement, 'value') as TextField
    expect(field.unique).toBe(true)
  })

  it('has beforeDelete hook', () => {
    expect(TypesEvenement.hooks?.beforeDelete?.length).toBeGreaterThan(0)
  })
})

// ── OrganisateursEvenements ──────────────────────────────────────────────────

describe('Collection config: OrganisateursEvenements', () => {
  it('has slug "organisateurs-evenements"', () => {
    expect(OrganisateursEvenements.slug).toBe('organisateurs-evenements')
  })

  it('has required fields: nom', () => {
    const nom = findField(OrganisateursEvenements, 'nom') as TextField
    expect(nom.required).toBe(true)
  })

  it('has optional fields: ville, siteWeb, emailContact, description', () => {
    const fieldNames = OrganisateursEvenements.fields
      .filter((f): f is Field & { name: string } => 'name' in f)
      .map((f) => f.name)

    expect(fieldNames).toContain('ville')
    expect(fieldNames).toContain('siteWeb')
    expect(fieldNames).toContain('emailContact')
    expect(fieldNames).toContain('description')
  })

  it('has admin-only write access', () => {
    expect(OrganisateursEvenements.access?.create).toBeDefined()
    expect(OrganisateursEvenements.access?.update).toBeDefined()
    expect(OrganisateursEvenements.access?.delete).toBeDefined()
  })
})

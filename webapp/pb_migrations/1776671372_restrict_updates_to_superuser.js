/// <reference path="../pb_data/types.d.ts" />
// Lock down updates on facility_uploads to superusers only.
// list/view/create stay public; delete was already superuser-only.
// shared_analyses already has updateRule=null — no change needed there.
//
// Uses raw SQL because app.save(collection) on this collection fails with
// "name must not match an existing collection id" in PB 0.25.x when the
// collection's id equals its name (legacy naming from the initial migration).

migrate((app) => {
  app.db().newQuery("UPDATE _collections SET updateRule = NULL WHERE id = 'facility_uploads'").execute()
}, (app) => {
  app.db().newQuery("UPDATE _collections SET updateRule = '' WHERE id = 'facility_uploads'").execute()
})

/// <reference path="../pb_data/types.d.ts" />
// PocketBase v0.23+ uses `fields:` (not `schema:`). The original migration used
// the legacy schema syntax which PB 0.25.x silently ignores — the table was
// created with only `id`, and every upload's field data was discarded.

migrate((app) => {
  const collection = new Collection({
    "id": "facility_uploads",
    "name": "facility_uploads",
    "type": "base",
    "system": false,
    "listRule": "",
    "viewRule": "",
    "createRule": "",
    "updateRule": null,
    "deleteRule": null,
    "fields": [
      {
        "hidden": false,
        "id": "text3208210256",
        "autogeneratePattern": "[a-z0-9]{15}",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_facility_name",
        "max": 0,
        "min": 0,
        "name": "facility_name",
        "pattern": "",
        "presentable": true,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_date_start",
        "max": 0,
        "min": 0,
        "name": "date_range_start",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "text_date_end",
        "max": 0,
        "min": 0,
        "name": "date_range_end",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "num_file_count",
        "max": null,
        "min": null,
        "name": "file_count",
        "onlyInt": true,
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "file_xls",
        "maxSelect": 99,
        "maxSize": 52428800,
        "mimeTypes": [],
        "name": "xls_files",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "hidden": false,
        "id": "file_csv",
        "maxSelect": 99,
        "maxSize": 52428800,
        "mimeTypes": [],
        "name": "csv_files",
        "presentable": false,
        "protected": false,
        "required": false,
        "system": false,
        "thumbs": [],
        "type": "file"
      },
      {
        "hidden": false,
        "id": "json_summary",
        "maxSize": 2000000,
        "name": "summary_kpi",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "json"
      }
    ]
  })

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("facility_uploads")
  return app.delete(collection)
})

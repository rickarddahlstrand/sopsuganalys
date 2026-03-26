/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    id: "facility_uploads",
    name: "facility_uploads",
    type: "base",
    system: false,
    schema: [
      {
        system: false,
        id: "fu_facility_name",
        name: "facility_name",
        type: "text",
        required: true,
        presentable: true,
        options: {
          min: null,
          max: null,
          pattern: "",
        },
      },
      {
        system: false,
        id: "fu_date_range_start",
        name: "date_range_start",
        type: "text",
        required: true,
        options: {
          min: null,
          max: null,
          pattern: "",
        },
      },
      {
        system: false,
        id: "fu_date_range_end",
        name: "date_range_end",
        type: "text",
        required: true,
        options: {
          min: null,
          max: null,
          pattern: "",
        },
      },
      {
        system: false,
        id: "fu_file_count",
        name: "file_count",
        type: "number",
        required: true,
        options: {
          min: null,
          max: null,
          noDecimal: true,
        },
      },
      {
        system: false,
        id: "fu_xls_files",
        name: "xls_files",
        type: "file",
        required: false,
        options: {
          mimeTypes: [],
          thumbs: [],
          maxSelect: 99,
          maxSize: 52428800,
          protected: false,
        },
      },
      {
        system: false,
        id: "fu_csv_files",
        name: "csv_files",
        type: "file",
        required: false,
        options: {
          mimeTypes: [],
          thumbs: [],
          maxSelect: 99,
          maxSize: 52428800,
          protected: false,
        },
      },
      {
        system: false,
        id: "fu_summary_kpi",
        name: "summary_kpi",
        type: "json",
        required: false,
        options: {
          maxSize: 2000000,
        },
      },
    ],
    indexes: [],
    listRule: "",
    viewRule: "",
    createRule: "",
    updateRule: "",
    deleteRule: null,
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("facility_uploads");
  return app.delete(collection);
});

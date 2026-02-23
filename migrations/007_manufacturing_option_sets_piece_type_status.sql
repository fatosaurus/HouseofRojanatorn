-- Extend manufacturing option sets with piece type and status categories.

IF OBJECT_ID('dbo.manufacturing_option_sets', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.manufacturing_option_sets (
        id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        option_key NVARCHAR(80) NOT NULL,
        label NVARCHAR(140) NOT NULL,
        options_json NVARCHAR(MAX) NOT NULL,
        created_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        updated_at_utc DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.manufacturing_option_sets')
      AND name = 'UX_manufacturing_option_sets_option_key'
)
BEGIN
    CREATE UNIQUE INDEX UX_manufacturing_option_sets_option_key
        ON dbo.manufacturing_option_sets(option_key);
END
GO

MERGE dbo.manufacturing_option_sets AS target
USING (
    SELECT
        'piece_type' AS option_key,
        'Piece Type' AS label,
        '["earrings","bracelet","choker","necklace","brooch","ring","pendant","other"]' AS options_json
    UNION ALL
    SELECT
        'status',
        'Status',
        '["approved","sent_to_craftsman","internal_setting_qc","diamond_sorting","stone_setting","plating","final_piece_qc","complete_piece","ready_for_sale","sold"]'
) AS source
ON target.option_key = source.option_key
WHEN MATCHED THEN
    UPDATE SET
        label = source.label,
        options_json = source.options_json,
        updated_at_utc = SYSUTCDATETIME()
WHEN NOT MATCHED THEN
    INSERT (option_key, label, options_json, updated_at_utc)
    VALUES (source.option_key, source.label, source.options_json, SYSUTCDATETIME());
GO

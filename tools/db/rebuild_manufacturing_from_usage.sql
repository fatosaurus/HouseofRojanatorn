-- Rebuild manufacturing records from imported usage batches/lines.
-- This removes existing manufacturing project rows (including mock/demo rows)
-- and recreates them from gem_usage_batches / gem_usage_lines.

SET NOCOUNT ON;

IF OBJECT_ID('dbo.manufacturing_projects', 'U') IS NULL
BEGIN
    RAISERROR('dbo.manufacturing_projects table not found.', 16, 1);
    RETURN;
END

IF OBJECT_ID('dbo.gem_usage_batches', 'U') IS NULL
BEGIN
    RAISERROR('dbo.gem_usage_batches table not found.', 16, 1);
    RETURN;
END

BEGIN TRANSACTION;

BEGIN TRY
    DELETE FROM dbo.manufacturing_activity_log;
    DELETE FROM dbo.manufacturing_project_gemstones;
    DELETE FROM dbo.manufacturing_projects;

    DECLARE @ProjectMap TABLE (
        batch_id INT NOT NULL PRIMARY KEY,
        project_id INT NOT NULL,
        product_code NVARCHAR(64) NOT NULL,
        requester_name NVARCHAR(160) NULL,
        source_sheet NVARCHAR(64) NULL,
        source_row INT NULL,
        transaction_date DATE NULL
    );

    DECLARE @InsertedProjects TABLE (
        project_id INT NOT NULL,
        manufacturing_code NVARCHAR(64) NOT NULL PRIMARY KEY
    );

    ;WITH UsageLineTotals AS (
        SELECT
            ul.batch_id,
            SUM(COALESCE(ul.line_amount, 0)) AS usage_line_total
        FROM dbo.gem_usage_lines ul
        GROUP BY ul.batch_id
    ),
    NormalizedBatches AS (
        SELECT
            b.id AS batch_id,
            LTRIM(RTRIM(b.product_code)) AS product_code,
            NULLIF(LTRIM(RTRIM(b.product_category)), '') AS product_category,
            b.transaction_date,
            NULLIF(LTRIM(RTRIM(b.requester_name)), '') AS requester_name,
            b.source_sheet,
            b.source_row,
            COALESCE(b.total_amount, u.usage_line_total, 0) AS amount_value
        FROM dbo.gem_usage_batches b
        LEFT JOIN UsageLineTotals u
            ON u.batch_id = b.id
        WHERE b.product_code IS NOT NULL
          AND LTRIM(RTRIM(b.product_code)) <> ''
    )
    INSERT INTO dbo.manufacturing_projects (
        manufacturing_code,
        piece_name,
        piece_type,
        design_date,
        designer_name,
        status,
        craftsman_name,
        metal_plating_json,
        metal_plating_notes,
        setting_cost,
        diamond_cost,
        gemstone_cost,
        total_cost,
        selling_price,
        completion_date,
        usage_notes,
        photos_json,
        customer_id,
        sold_at,
        updated_at_utc
    )
    OUTPUT
        INSERTED.id,
        INSERTED.manufacturing_code
    INTO @InsertedProjects (project_id, manufacturing_code)
    SELECT
        nb.product_code AS manufacturing_code,
        CONCAT(
            UPPER(LEFT(COALESCE(REPLACE(nb.product_category, '_', ' '), 'piece'), 1)),
            LOWER(SUBSTRING(COALESCE(REPLACE(nb.product_category, '_', ' '), 'piece'), 2, 200)),
            N' ',
            nb.product_code
        ) AS piece_name,
        CASE
            WHEN nb.product_category IN ('earrings', 'bracelet', 'choker', 'necklace', 'brooch', 'ring', 'pendant', 'other')
                THEN nb.product_category
            ELSE 'other'
        END AS piece_type,
        nb.transaction_date AS design_date,
        nb.requester_name AS designer_name,
        'complete_piece' AS status,
        nb.requester_name AS craftsman_name,
        N'[]' AS metal_plating_json,
        NULL AS metal_plating_notes,
        0 AS setting_cost,
        0 AS diamond_cost,
        CAST(nb.amount_value AS DECIMAL(18, 2)) AS gemstone_cost,
        CAST(nb.amount_value AS DECIMAL(18, 2)) AS total_cost,
        CAST(nb.amount_value AS DECIMAL(18, 2)) AS selling_price,
        nb.transaction_date AS completion_date,
        CONCAT(
            N'Imported from usage batch #',
            CONVERT(NVARCHAR(20), nb.batch_id),
            N' | sheet: ',
            COALESCE(nb.source_sheet, N'-'),
            N' | row: ',
            COALESCE(CONVERT(NVARCHAR(20), nb.source_row), N'-'),
            N' | requester: ',
            COALESCE(nb.requester_name, N'-'),
            N' | original category: ',
            COALESCE(nb.product_category, N'-')
        ) AS usage_notes,
        N'[]' AS photos_json,
        NULL AS customer_id,
        NULL AS sold_at,
        SYSUTCDATETIME() AS updated_at_utc
    FROM NormalizedBatches nb
    ORDER BY nb.transaction_date DESC, nb.batch_id DESC;

    INSERT INTO @ProjectMap (
        batch_id,
        project_id,
        product_code,
        requester_name,
        source_sheet,
        source_row,
        transaction_date
    )
    SELECT
        b.id AS batch_id,
        ip.project_id,
        LTRIM(RTRIM(b.product_code)) AS product_code,
        NULLIF(LTRIM(RTRIM(b.requester_name)), '') AS requester_name,
        b.source_sheet,
        b.source_row,
        b.transaction_date
    FROM dbo.gem_usage_batches b
    INNER JOIN @InsertedProjects ip
        ON ip.manufacturing_code = LTRIM(RTRIM(b.product_code))
    WHERE b.product_code IS NOT NULL
      AND LTRIM(RTRIM(b.product_code)) <> '';

    INSERT INTO dbo.manufacturing_project_gemstones (
        project_id,
        inventory_item_id,
        gemstone_code,
        gemstone_type,
        pieces_used,
        weight_used_ct,
        line_cost,
        notes
    )
    SELECT
        pm.project_id,
        inv.inventory_item_id,
        CASE
            WHEN ul.gemstone_number IS NULL THEN NULL
            ELSE CONVERT(NVARCHAR(64), ul.gemstone_number)
        END AS gemstone_code,
        COALESCE(inv.inventory_gemstone_type, NULLIF(LTRIM(RTRIM(ul.gemstone_name)), '')) AS gemstone_type,
        COALESCE(ul.used_pcs, 0) AS pieces_used,
        COALESCE(ul.used_weight_ct, 0) AS weight_used_ct,
        CAST(COALESCE(ul.line_amount, 0) AS DECIMAL(18, 2)) AS line_cost,
        CONCAT(
            N'Gemstone Name: ',
            COALESCE(NULLIF(LTRIM(RTRIM(ul.gemstone_name)), ''), N'-'),
            N' | Unit Price: ',
            COALESCE(NULLIF(LTRIM(RTRIM(ul.unit_price_raw)), ''), N'-'),
            N' | Balance After (pcs/ct): ',
            COALESCE(CONVERT(NVARCHAR(40), ul.balance_pcs_after), N'-'),
            N'/',
            COALESCE(CONVERT(NVARCHAR(40), ul.balance_ct_after), N'-'),
            N' | Requester: ',
            COALESCE(NULLIF(LTRIM(RTRIM(ul.requester_name)), ''), N'-')
        ) AS notes
    FROM dbo.gem_usage_lines ul
    INNER JOIN @ProjectMap pm
        ON pm.batch_id = ul.batch_id
    OUTER APPLY (
        SELECT TOP 1
            i.id AS inventory_item_id,
            i.gemstone_type AS inventory_gemstone_type
        FROM dbo.gem_inventory_items i
        WHERE i.gemstone_number = ul.gemstone_number
        ORDER BY i.id DESC
    ) inv;

    INSERT INTO dbo.manufacturing_activity_log (
        project_id,
        status,
        activity_at_utc,
        craftsman_name,
        notes
    )
    SELECT
        pm.project_id,
        'complete_piece',
        COALESCE(CAST(pm.transaction_date AS DATETIME2), SYSUTCDATETIME()) AS activity_at_utc,
        pm.requester_name,
        CONCAT(
            N'Imported from usage batch #',
            CONVERT(NVARCHAR(20), pm.batch_id),
            N' (code ',
            pm.product_code,
            N')'
        ) AS notes
    FROM @ProjectMap pm;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
    BEGIN
        ROLLBACK TRANSACTION;
    END

    DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
    DECLARE @ErrorSeverity INT = ERROR_SEVERITY();
    DECLARE @ErrorState INT = ERROR_STATE();
    RAISERROR(@ErrorMessage, @ErrorSeverity, @ErrorState);
END CATCH

SELECT
    (SELECT COUNT(*) FROM dbo.manufacturing_projects) AS manufacturing_projects,
    (SELECT COUNT(*) FROM dbo.manufacturing_project_gemstones) AS manufacturing_project_gemstones,
    (SELECT COUNT(*) FROM dbo.manufacturing_activity_log) AS manufacturing_activity_log;

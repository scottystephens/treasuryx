#!/bin/bash

# Stratifi Rebrand Script
# Updates all TreasuryX references to Stratifi

echo "🎨 Starting Stratifi rebrand..."
echo ""

# Update app pages
find app -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' 's/TreasuryX/Stratifi/g' {} \;
find app -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' 's/treasuryx/stratifi/g' {} \;

echo "✓ Updated app/ files"

# Update docs
find docs -type f -name "*.md" -exec sed -i '' 's/TreasuryX/Stratifi/g' {} \;
find docs -type f -name "*.md" -exec sed -i '' 's/treasuryx/stratifi/g' {} \;

echo "✓ Updated docs/ files"

# Update scripts
find scripts -type f \( -name "*.ts" -o -name "*.md" -o -name "*.sql" \) -exec sed -i '' 's/TreasuryX/Stratifi/g' {} \;
find scripts -type f \( -name "*.ts" -o -name "*.md" -o -name "*.sql" \) -exec sed -i '' 's/treasuryx/stratifi/g' {} \;

echo "✓ Updated scripts/ files"

# Update lib files
find lib -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' 's/TreasuryX/Stratifi/g' {} \;
find lib -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i '' 's/treasuryx/stratifi/g' {} \;

echo "✓ Updated lib/ files"

# Update data files
find data -type f -name "*.csv" -exec sed -i '' 's/TreasuryX/Stratifi/g' {} \;
find data -type f -name "*.md" -exec sed -i '' 's/TreasuryX/Stratifi/g' {} \;

echo "✓ Updated data/ files"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Rebrand Complete!"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "Changed:"
echo "  • TreasuryX → Stratifi"
echo "  • treasuryx → stratifi"
echo ""
echo "Updated in:"
echo "  • app/ - All page and component files"
echo "  • docs/ - All documentation"
echo "  • scripts/ - All scripts and SQL files"
echo "  • lib/ - All library files"
echo "  • data/ - CSV and markdown files"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Test build: npm run build"
echo "  3. Commit: git commit -am 'rebrand: Complete rebrand to Stratifi'"
echo ""


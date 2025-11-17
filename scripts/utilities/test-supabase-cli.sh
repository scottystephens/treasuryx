#!/bin/bash
# Quick test script to verify Supabase CLI is working

set -e

export PATH="$HOME/.local/bin:$PATH"

echo "🧪 Testing Supabase CLI Configuration"
echo "======================================"
echo ""

# Check if CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found in PATH"
    echo "   Make sure ~/.local/bin is in your PATH"
    exit 1
fi

echo "✅ Supabase CLI found: $(supabase --version)"
echo ""

# Test authentication
echo "🔐 Testing authentication..."
if supabase projects list &> /dev/null; then
    echo "✅ Authenticated successfully"
    echo ""
    
    # Show linked project
    echo "📋 Linked Projects:"
    supabase projects list
    echo ""
    
    echo "✨ Supabase CLI is configured and ready to use!"
    echo ""
    echo "You can now use commands like:"
    echo "  - supabase db execute --file <migration.sql>"
    echo "  - supabase gen types typescript --project-id vnuithaqtpgbwmdvtxik"
    echo "  - supabase projects api-keys --project-ref vnuithaqtpgbwmdvtxik"
else
    echo "❌ Authentication failed"
    echo "   Run: supabase login"
    exit 1
fi


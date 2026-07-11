// Native node env loading used
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function test() {
  console.log("Testing Supabase connection...");
  const { data, error } = await supabase
    .from("documents")
    .insert({ name: "test_doc.pdf" })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase Error Details:");
    console.error(JSON.stringify(error, null, 2));
  } else {
    console.log("Success! Inserted document:", data);
    
    // Clean up
    await supabase.from("documents").delete().eq("id", data.id);
    console.log("Cleaned up test document.");
  }
}

test();

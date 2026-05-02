import csv
import random

INPUT_FILE = "input.csv"
OUTPUT_FILE = "output.csv"
MAX_ROWS = 55555

PLANS = ["free", "pro", "max"]

TAGS_POOL = [
    "premium",
    "active",
    "inactive",
    "tier1",
    "tier2",
    "trial",
    "new",
    "loyal",
    "high_value"
]

def generate_random_tags():
    # pick between 0 to 3 tags randomly
    num_tags = random.randint(0, 3)
    if num_tags == 0:
        return ""
    return ";".join(random.sample(TAGS_POOL, num_tags))

def process_csv():
    processed_count = 0

    with open(INPUT_FILE, mode="r", encoding="utf-8") as infile, \
         open(OUTPUT_FILE, mode="w", newline="", encoding="utf-8") as outfile:

        reader = csv.DictReader(infile)

        fieldnames = ["name", "email", "phone", "tags", "city", "plan"]
        writer = csv.DictWriter(outfile, fieldnames=fieldnames)

        writer.writeheader()

        for row in reader:
            if processed_count >= MAX_ROWS:
                break

            email = (row.get("Email") or "").strip()
            if not email:
                continue  # skip invalid rows

            first_name = (row.get("First Name") or "").strip()
            last_name = (row.get("Last Name") or "").strip()
            name = f"{first_name} {last_name}".strip()

            # fallback to Phone 2 if Phone 1 is empty
            phone = (row.get("Phone 1") or row.get("Phone 2") or "").strip()

            city = (row.get("City") or "").strip()

            plan = random.choice(PLANS)
            tags = generate_random_tags()

            output_row = {
                "name": name,
                "email": email,
                "phone": phone,
                "tags": tags,
                "city": city,
                "plan": plan
            }

            writer.writerow(output_row)
            processed_count += 1

    print(f"Done! Processed {processed_count} rows.")

if __name__ == "__main__":
    process_csv()
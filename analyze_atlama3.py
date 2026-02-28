import json

file_path = 'sinavsistemi-c58fe-default-rtdb-export (6).json'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # 1. Find Video "Zorunlu Atlama 3" or similar
    target_titles = ["atlama 3", "atlama d 3", "zorunlu atlama 3"]
    video_id = None
    video_obj = None

    print("Searching for video...")
    for vid, video in data['videos'].items():
        title = video.get('title', '').lower()
        if any(t in title for t in target_titles):
            video_id = vid
            video_obj = video
            print(f"Found Video: {video.get('title')} (ID: {vid})")
            print(f"  Type: {video.get('type')}")
            print(f"  Expert D: {video.get('expertD')}")
            print(f"  Expert E: {video.get('expertE')}")
            break
    
    if not video_id:
        print("Video not found.")
        exit()

    # 2. Find Results for this video
    print(f"\nSearching results for Video ID: {video_id}")
    
    results = []
    # Results might be flat or nested under exams?
    # Based on previous steps, it seemed flat or nested in keys.
    # Let's verify structure by checking 'results' key
    
    if 'results' in data:
        # Check if it's a direct map or nested
        # Based on file view, it looked like direct map of IDs? 
        # Or keys resultId -> { videoId, refereeId ... }
        
        # Let's traverse
        count = 0
        for key, val in data['results'].items():
            # If val has videoId check it
            if val.get('videoId') == video_id:
                results.append(val)
                count += 1
            # If nested (e.g. by examId), we might need recursion, 
            # but previous steps suggested flat results map in export? 
            # Actually user said "database json structure" might be complex.
            # In step 1517, results looked like: "-Ojoi..." : { videoId: ... }
            # So it is flat.
        
        print(f"Found {count} results.")
        
        print(f"\n{'-'*60}")
        print(f"{'Referee Name':<30} | {'Type':<5} | {'D':<5} | {'E':<5} | {'Points':<6} | {'Dev':<5}")
        print(f"{'-'*60}")
        
        for res in results:
            ref_name = res.get('refereeName', 'Unknown')
            r_type = res.get('type', '?')
            d = res.get('d', 0)
            e = res.get('e', 0)
            pts = res.get('points', 0)
            dev = res.get('dev', 0)
            
            print(f"{ref_name:<30} | {r_type:<5} | {d:<5} | {e:<5} | {pts:<6} | {dev:<5}")

except Exception as e:
    print(f"Error: {e}")

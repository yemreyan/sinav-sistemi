import json

file_path = 'sinavsistemi-c58fe-default-rtdb-export (6).json'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("Data loaded successfully.")

    # 1. Find Referee - Broad Search
    target_ref_name = "yunus".lower()
    referee_id = None
    referee_full_name = ""

    print(f"Searching for referee containing: {target_ref_name}")
    if 'referees' in data:
        for rid, ref in data['referees'].items():
            name = ref.get('name', '').lower()
            if target_ref_name in name:
                referee_id = rid
                referee_full_name = ref.get('name')
                print(f"Found Candidate: {referee_full_name} (ID: {referee_id})")
                # If distinct enough, pick first. If multiple, we might need manual check.
                # For now, pick the last one or prompt? Let's just pick the last match.
    
    if not referee_id:
        print("Referee 'Yunus' not found! Listing first 50 referees:")
        count = 0
        for rid, ref in data['referees'].items():
            print(f"- {ref.get('name')}")
            count += 1
            if count > 50: break
        exit()

    # 2. Find Video
    target_video_title = "barfiks e 2".lower() # "zorunlu" might be omitted or formatted differently
    video_id = None
    video_title = ""
    expert_e = 0
    expert_d = 0
    
    print(f"Searching for video: {target_video_title}")
    if 'videos' in data:
        for vid, video in data['videos'].items():
            title = video.get('title', '').lower()
            # Normalize title for better matching (remove extra spaces)
            title_norm = ' '.join(title.split())
            if "barfiks" in title_norm and "e 2" in title_norm: # More loose match
                 # Check if "Zorunlu" is also there if requested, but let's match loose first
                 video_id = vid
                 video_title = video.get('title')
                 expert_e = video.get('expertE', 0)
                 expert_d = video.get('expertD', 0)
                 print(f"Found Video: {video_title} (ID: {video_id})")
                 print(f"  Expert E: {expert_e}")
                 print(f"  Expert D: {expert_d}")
                 # Don't break immediately, maybe there is a 'Zorunlu' one?
                 if "zorunlu" in title_norm:
                     break 

    if not video_id:
        print("Video not found!")
        exit()

    # 3. Find Result
    print(f"Searching for result (Ref: {referee_id}, Vid: {video_id})")
    found_result = None
    
    if 'results' in data:
        # Results are flat? Or nested?
        # Usually results are stored by resultId, so we iterate
        for resid, res in data['results'].items():
            if res.get('refereeId') == referee_id and res.get('videoId') == video_id:
                found_result = res
                print("Found result!")
                break
    
    if found_result:
        judge_e = found_result.get('e', 0)
        judge_d = found_result.get('d', 0)
        judge_score = found_result.get('points', 0)
        
        print("\n=== ANALYSIS RESULT ===")
        print(f"Hakem: {referee_full_name}")
        print(f"Video: {video_title}")
        print("-" * 20)
        print(f"Uzman E Puanı: {expert_e}")
        print(f"Hakem E Puanı: {judge_e}")
        print(f"Fark (Sapma): {expert_e - judge_e:.2f}")
        print("-" * 20)
        print(f"Uzman D Puanı: {expert_d}")
        print(f"Hakem D Puanı: {judge_d}")
        print("-" * 20)
        print(f"Hakem Toplam Puan: {judge_score}")
        
    else:
        print("This referee has not scored this video yet.")

except Exception as e:
    print(f"Error: {e}")

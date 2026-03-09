import { ref, computed } from 'vue'
import { useLocalStorage } from '@vueuse/core'

const WATCHLIST_KEY = 'anime-roulette-watchlist'
const URL = 'https://api.jikan.moe/v4/random/anime'
const MAX_SAFE_SPIN_ATTEMPTS = 5
const RETRY_SECONDS = 10

const isAllowedRating = (rating) => {
  if (!rating) return false
  return !rating.trim().startsWith('R')
}

export function useAnimeRoulette() {
  const anime = ref(null)
  const loading = ref(false)
  const error = ref('')
  const spinAttempts = ref(0)
  const cooldownLeft = ref(0) // Missing from your original code

  const watchlist = useLocalStorage(WATCHLIST_KEY, [])
  const spinning = ref(false)
  
  const isLoading = computed(() => loading.value || spinning.value)

  const spin = async () => {
    if (isLoading.value) return
    
    loading.value = true
    error.value = ''
    spinAttempts.value = 0
    
    try {
      let foundAnime = null
      
      while (spinAttempts.value < MAX_SAFE_SPIN_ATTEMPTS && !foundAnime) {
        spinAttempts.value++
        
        try {
          const response = await fetch(URL)
          
          // Check if rate limited
          if (response.status === 429) {
            cooldownLeft.value = RETRY_SECONDS
            error.value = 'Rate limited. Please wait...'
            
            // Start cooldown countdown
            const interval = setInterval(() => {
              cooldownLeft.value--
              if (cooldownLeft.value <= 0) {
                clearInterval(interval)
              }
            }, 1000)
            
            break
          }
          
          const data = await response.json()
          
          if (data && data.data) {
            const randomAnime = data.data
            
            if (randomAnime && isAllowedRating(randomAnime.rating)) {
              foundAnime = randomAnime
              anime.value = randomAnime
            }
          }
        } catch (fetchErr) {
          console.error('Fetch attempt failed:', fetchErr)
          error.value = fetchErr.message
        }
        
        if (!foundAnime && spinAttempts.value < MAX_SAFE_SPIN_ATTEMPTS && cooldownLeft.value === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
      
      if (!foundAnime && cooldownLeft.value === 0) {
        error.value = 'Could not find suitable anime after multiple attempts'
      }
      
    } catch (err) {
      console.error('Spin error:', err)
      error.value = err.message || 'Failed to fetch anime'
    } finally {
      loading.value = false
      spinning.value = false
    }
  }
  
  const addToWatchlist = (animeItem) => {
    if (!animeItem) return
    
    const exists = watchlist.value.some(item => item.mal_id === animeItem.mal_id)
    if (!exists) {
      watchlist.value = [...watchlist.value, animeItem]
    }
  }
  
  const removeFromWatchlist = (animeId) => {
    watchlist.value = watchlist.value.filter(item => item.mal_id !== animeId)
  }
  
  const isInWatchlist = (animeId) => {
    return watchlist.value.some(item => item.mal_id === animeId)
  }

  return {
    anime,
    loading,
    error,
    watchlist,
    spinning,
    isLoading,
    spinAttempts,
    cooldownLeft, // Added this
    spin,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist
  }
}
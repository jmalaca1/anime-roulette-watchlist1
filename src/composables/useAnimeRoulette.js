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
        }
        
        if (!foundAnime && spinAttempts.value < MAX_SAFE_SPIN_ATTEMPTS) {
          await new Promise(resolve => setTimeout(resolve, RETRY_SECONDS * 1000))
        }
      }
      
      if (!foundAnime) {
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
    spin,
    addToWatchlist,
    removeFromWatchlist,
    isInWatchlist
  }
}
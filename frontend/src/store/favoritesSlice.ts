import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** Избранное — список id товаров. */
export interface FavoritesState {
  ids: string[];
}

const initialState: FavoritesState = { ids: [] };

const favoritesSlice = createSlice({
  name: 'favorites',
  initialState,
  reducers: {
    toggleFavorite(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.ids = state.ids.includes(id) ? state.ids.filter((x) => x !== id) : [id, ...state.ids];
    },
    hydrateFavorites(state, action: PayloadAction<string[]>) {
      state.ids = action.payload;
    },
  },
});

export const { toggleFavorite, hydrateFavorites } = favoritesSlice.actions;
export default favoritesSlice.reducer;

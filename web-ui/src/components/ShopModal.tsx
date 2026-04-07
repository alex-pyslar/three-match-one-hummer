import React from 'react'
import { ShopItem } from '../types'
import { api } from '../services/api'

interface ShopModalProps {
  open: boolean
  donationCurrency: number
  shopItems: ShopItem[]
  onBuy: (amount: number) => void
  onClose: () => void
}

const SHOP_ICONS: Record<string, string> = {
  shop1: '/assets/shop1.png',
  shop2: '/assets/shop2.png',
  shop3: '/assets/shop3.png',
}

/** Fallback items shown when the server hasn't responded yet */
const DEFAULT_ITEMS: ShopItem[] = [
  { id: 'local-1', name: 'Малый пакет',   description: '50 кристаллов',  price: 0, value: 50,  item_type: 'donation_pack', icon: 'shop1' },
  { id: 'local-2', name: 'Средний пакет', description: '150 кристаллов', price: 0, value: 150, item_type: 'donation_pack', icon: 'shop2' },
  { id: 'local-3', name: 'Большой пакет', description: '500 кристаллов', price: 0, value: 500, item_type: 'donation_pack', icon: 'shop3' },
]

const ShopModal: React.FC<ShopModalProps> = ({
  open,
  donationCurrency,
  shopItems,
  onBuy,
  onClose,
}) => {
  if (!open) return null

  const items = shopItems.length > 0 ? shopItems : DEFAULT_ITEMS

  const handleBuy = async (item: ShopItem) => {
    if (item.item_type === 'donation_pack') {
      try {
        await api.purchaseItem(item.id)
      } catch {
        // Optimistically proceed even if the API call fails
      }
      onBuy(item.value)
    } else {
      onBuy(item.value)
    }
  }

  const resolveIcon = (icon: string) =>
    icon.startsWith('/') ? icon : (SHOP_ICONS[icon] ?? '/assets/shop1.png')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card shop-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">🛒 Магазин</h2>
          <button className="modal-close" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="shop-modal__currency">
          <img src="/assets/donation.png" alt="crystals" className="shop-modal__currency-icon" />
          <span className="shop-modal__currency-amount">{donationCurrency} 💎</span>
        </div>

        <div className="shop-modal__items">
          {items.map(item => (
            <div key={item.id} className="shop-item">
              <div className="shop-item__icon-wrap">
                <img
                  src={resolveIcon(item.icon)}
                  alt={item.name}
                  className="shop-item__icon"
                />
              </div>
              <div className="shop-item__info">
                <div className="shop-item__name">{item.name}</div>
                <div className="shop-item__desc">{item.description}</div>
              </div>
              <button className="shop-item__buy-btn" onClick={() => handleBuy(item)}>
                {item.price > 0 ? `${item.price} 💎` : 'Бесплатно'}
                <br />
                <span className="shop-item__buy-label">Купить</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShopModal

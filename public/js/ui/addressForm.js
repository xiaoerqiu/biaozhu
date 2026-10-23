import { openDialog } from './dialog.js';
import { escapeHtml, formatCoords, hasCoords, icon } from '../utils.js';

/**
 * 新增/编辑地址对话框
 *
 * @param {object} options
 * @param {object|null} options.item        编辑的地址，新增时为 null
 * @param {string[]} options.types          已有类型（输入建议）
 * @param {Function|null} options.pickPoint () => Promise<{lng, lat, address}|null>，地图不可用时为 null
 * @param {Function} options.onSubmit       (payload) => Promise，抛出异常时保持对话框打开
 */
export function openAddressForm({ item, types, pickPoint, onSubmit }) {
    const isEdit = Boolean(item);
    let coords = item && hasCoords(item) ? { lng: item.lng, lat: item.lat } : null;
    // 本次编辑中是否在地图上手动选过点
    let picked = false;

    const content = `
        <form class="form" novalidate>
            <label class="field">
                <span class="field-label">名称</span>
                <input name="name" maxlength="100" autocomplete="off" placeholder="例如：西湖国宾馆" value="${escapeHtml(item?.name)}">
            </label>
            <label class="field">
                <span class="field-label">地址 <em aria-hidden="true">*</em></span>
                <input name="address" maxlength="300" autocomplete="off" required aria-required="true"
                    placeholder="省 / 市 / 区 + 详细地址，越完整定位越准确" value="${escapeHtml(item?.address)}" autofocus>
                <span class="field-error" role="alert"></span>
            </label>
            <label class="field">
                <span class="field-label">类型</span>
                <input name="type" maxlength="50" list="type-options" autocomplete="off" placeholder="例如：酒店、湖景房" value="${escapeHtml(item?.type)}">
                <datalist id="type-options">${types.map((t) => `<option value="${escapeHtml(t)}">`).join('')}</datalist>
            </label>
            <div class="field">
                <span class="field-label">坐标</span>
                <div class="coord-row">
                    <span class="coord-value" data-coord></span>
                    ${pickPoint ? `<button type="button" class="btn btn-sm" data-pick>${icon('crosshair', 14)}在地图上选点</button>` : ''}
                    <button type="button" class="btn btn-sm btn-text" data-clear-coord>清除</button>
                </div>
                <span class="field-hint" data-coord-hint></span>
            </div>
            <button type="submit" hidden></button>
        </form>`;

    return openDialog({
        title: isEdit ? '编辑地址' : '新增地址',
        content,
        actions: [
            { label: '取消', value: null },
            { label: isEdit ? '保存' : '添加', value: 'save', variant: 'primary' }
        ],
        onOpen(body, dialog) {
            const form = body.querySelector('form');
            const addressInput = form.elements.address;
            const coordEl = body.querySelector('[data-coord]');
            const hintEl = body.querySelector('[data-coord-hint]');
            const clearBtn = body.querySelector('[data-clear-coord]');

            const addressChanged = () => isEdit && addressInput.value.trim() !== item.address;

            const renderCoords = () => {
                coordEl.textContent = coords ? formatCoords(coords) : '未设置';
                coordEl.classList.toggle('muted', !coords);
                clearBtn.hidden = !coords;
                if (!coords) hintEl.textContent = '保存后将根据地址自动定位';
                else if (addressChanged() && !picked) hintEl.textContent = '地址已修改，保存后将重新定位';
                else hintEl.textContent = '';
            };
            renderCoords();

            addressInput.addEventListener('input', () => {
                form.querySelector('.field-error').textContent = '';
                addressInput.removeAttribute('aria-invalid');
                renderCoords();
            });

            clearBtn.onclick = () => {
                coords = null;
                picked = false;
                renderCoords();
            };

            body.querySelector('[data-pick]')?.addEventListener('click', async () => {
                dialog.hide();
                const result = await pickPoint();
                dialog.show();
                if (!result) return;
                coords = { lng: result.lng, lat: result.lat };
                picked = true;
                if (!addressInput.value.trim() && result.address) addressInput.value = result.address;
                renderCoords();
            });
        },
        async onAction(value, body, dialog) {
            if (value !== 'save') return;
            const form = body.querySelector('form');
            const payload = {
                name: form.elements.name.value.trim(),
                address: form.elements.address.value.trim(),
                type: form.elements.type.value.trim()
            };
            if (!payload.address) {
                const input = form.elements.address;
                input.setAttribute('aria-invalid', 'true');
                form.querySelector('.field-error').textContent = '请填写地址';
                input.focus();
                return false;
            }

            // 地址变更且未手动选点时清空坐标，交由地理编码重新定位
            const keepCoords = coords && (picked || !isEdit || payload.address === item.address);
            payload.lng = keepCoords ? coords.lng : null;
            payload.lat = keepCoords ? coords.lat : null;

            dialog.setBusy(true);
            try {
                await onSubmit(payload);
            } catch {
                dialog.setBusy(false);
                return false;
            }
        }
    });
}

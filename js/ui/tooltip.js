/**
 * ui/tooltip.js — 마우스오버 툴팁 시스템
 *
 * [역할]
 * - data-tooltip-id / data-tooltip-type 속성이 있는 요소에 마우스를 올리면
 *   오퍼레이터/무기/장비 상세 정보를 툴팁으로 표시한다.
 * - 모바일/태블릿(≤1024px)에서는 툴팁을 비활성화한다.
 *
 * [의존]
 * - state.js   : getStatName
 * - data_*.js  : DATA_OPERATORS, DATA_WEAPONS, DATA_GEAR, DATA_SETS
 *
 * [내부 규칙]
 * - TRAIT_TYPES, SYNERGY_TYPES, EXCLUDE_TYPES 등 분류 상수는 AppTooltip 객체의
 *   프로퍼티로 정의한다. 함수 호출마다 재생성되는 것을 방지하기 위함이다.
 * - 툴팁 HTML은 template literal로 직접 생성한다.
 *   별도 DOM 조작보다 성능이 유리하다.
 * - position()은 viewport 경계를 확인하여 잘림이 없도록 좌우/상하 반전한다.
 */

// ============ 툴팁 시스템 ============

const AppTooltip = {
    el: null,

    // ---- 분류 상수 (매 호출마다 재생성 방지) ----

    /** 오퍼레이터/무기의 자체 버프 효과 타입 목록 */
    // [규칙] 새로운 효과 타입(예: 저항 무시)이 추가되면 반드시 이 배열에 포함시켜야 툴팁에 표시됩니다.
    TRAIT_TYPES: [
        '공격력 증가', '물리 피해', '아츠 피해', '열기 피해', '전기 피해', '냉기 피해', '자연 피해',
        '불균형 목표에 주는 피해', '일반 공격 피해', '배틀 스킬 피해', '연계 스킬 피해', '궁극기 피해',
        '모든 스킬 피해', '주는 피해', '오리지늄 아츠 강도', '치명타 확률', '치명타 피해',
        '물리 저항 무시', '열기 저항 무시', '전기 저항 무시', '냉기 저항 무시', '자연 저항 무시',
        '스킬 치명타 확률', '스킬 치명타 피해'
    ],
    /** 파티원(팀/적 대상) 시너지 효과 타입 목록 */
    // [규칙] 새로운 시너지/디버프 타입(예: 저항 감소)이 추가되면 반드시 이 배열에 포함시켜야 툴팁에 표시됩니다.
    SYNERGY_TYPES: [
        '물리 증폭', '아츠 증폭', '열기 증폭', '전기 증폭', '냉기 증폭', '자연 증폭',
        '물리 취약', '아츠 취약', '열기 취약', '전기 취약', '냉기 취약', '자연 취약',
        '받는 물리 피해', '받는 아츠 피해', '받는 열기 피해', '받는 전기 피해', '받는 냉기 피해', '받는 자연 피해',
        '받는 불균형 피해', '받는 피해', '연타', '저항 감소',
        '감전 부여', '동결 부여', '부식 부여', '연소 부여', '방어 불능 부여', '갑옷 파괴 부여',
        '열기 부착', '냉기 부착', '전기 부착', '자연 부착', '아츠 부착'
    ],
    /** 툴팁에 표시하지 않을 효과 타입 목록 (전투 외 효과) */
    EXCLUDE_TYPES: ['최대 체력', '궁극기 충전', '치유 효율', '모든 능력치', '치유', '비호', '보호'],

    /** 무기 타입 코드 → 한글 이름 */
    WEP_TYPE_MAP: { sword: '한손검', great_sword: '양손검', polearm: '장병기', handcannon: '권총', arts_unit: '아츠 유닛' },
    /** 장비 부위 코드 → 한글 이름 */
    GEAR_PART_MAP: { armor: '방어구', gloves: '글러브', kit: '부품' },

    /**
     * mouseover/mousemove/mouseout 이벤트 리스너를 등록하고 툴팁 요소를 초기화한다.
     * window.onload 이후 한 번만 호출해야 한다.
     */
    init() {
        this.el = document.getElementById('app-tooltip');
        if (!this.el) return;

        document.addEventListener('mouseover', (e) => {
            // 모바일/태블릿(≤1024px)에서는 툴팁 표시 방지
            if (window.innerWidth <= 1024) return;
            const target = e.target.closest('[data-tooltip-id]');
            if (!target) return;
            const id = target.getAttribute('data-tooltip-id');
            const type = target.getAttribute('data-tooltip-type');
            const pot = Number(target.getAttribute('data-tooltip-pot')) || 0;
            const forged = target.getAttribute('data-tooltip-forged') === 'true';
            if (id && type) this.show(id, type, pot, e, forged);
        });

        document.addEventListener('mousemove', (e) => {
            if (this.el.style.display === 'block') this.position(e);
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest('[data-tooltip-id]')) this.hide();
        });
    },

    /**
     * 툴팁을 표시한다.
     *
     * @param {string}       id     - 엔티티 ID
     * @param {string}       type   - 'operator' | 'weapon' | 'gear'
     * @param {number}       pot    - 잠재 레벨 (오퍼레이터 전용)
     * @param {MouseEvent}   event  - 마우스 이벤트 (위치 계산용)
     * @param {boolean}      forged - 단조 여부 (장비 전용)
     */
    show(id, type, pot, event, forged = false) {
        const data = this.getData(id, type);
        if (!data) return;
        let content = '';
        if (type === 'operator') content = this.renderOperator(data, pot);
        else if (type === 'weapon') content = this.renderWeapon(data);
        else if (type === 'gear') content = this.renderGear(data, forged);
        this.el.innerHTML = content;
        this.el.style.display = 'block';
        if (event) this.position(event);
    },

    /**
     * 커스텀 콘텐츠를 툴팁으로 표시한다.
     * @param {string} content - HTML 콘텐츠
     * @param {MouseEvent} event - 마우스 이벤트
     */
    showCustom(content, event) {
        this.el.innerHTML = content;
        this.el.style.display = 'block';
        if (event) this.position(event);
    },


    /** 툴팁을 숨긴다. */
    hide() { if (this.el) this.el.style.display = 'none'; },

    /**
     * 마우스 위치를 기반으로 툴팁 위치를 계산한다.
     * viewport 경계를 넘으면 반대 방향으로 배치한다.
     *
     * @param {MouseEvent} e - 마우스 이벤트
     */
    position(e) {
        const offset = 20;
        let x = e.clientX + offset;
        let y = e.clientY + offset;
        if (x + this.el.offsetWidth > window.innerWidth) x = e.clientX - this.el.offsetWidth - offset;
        if (y + this.el.offsetHeight > window.innerHeight) y = e.clientY - this.el.offsetHeight - offset;
        this.el.style.left = x + 'px';
        this.el.style.top = y + 'px';
    },

    /**
     * 타입에 따라 DATA_* 배열에서 데이터를 조회한다.
     *
     * @param {string} id   - 엔티티 ID
     * @param {string} type - 'operator' | 'weapon' | 'gear'
     * @returns {object|null}
     */
    getData(id, type) {
        if (type === 'operator') return DATA_OPERATORS.find(o => o.id === id);
        if (type === 'weapon') return DATA_WEAPONS.find(w => w.id === id);
        if (type === 'gear') return DATA_GEAR.find(g => g.id === id);
        return null;
    },

    /**
     * 오퍼레이터의 속성명을 반환한다.
     * phys 타입이면 '물리', 나머지는 element 필드로 판단한다.
     */
    getElementName(op) {
        if (op.type === 'phys') return '물리';
        return { heat: '열기', cryo: '냉기', elec: '전기', nature: '자연' }[op.element] || '아츠';
    },

    /** 무기 타입 코드를 한글로 변환한다. */
    getWepTypeName(type) { return this.WEP_TYPE_MAP[type] || type; },

    /**
     * 오퍼레이터 툴팁 HTML을 렌더링한다.
     * 특성(자체 버프), 시너지(팀/적 대상)를 분리하여 표시한다.
     * 잠재 효과는 현재 잠재 레벨(currentPot) 이하만 활성 상태로 표시한다.
     *
     * @param {object} op          - 오퍼레이터 데이터
     * @param {number} currentPot  - 현재 잠재 레벨
     * @returns {string} HTML 문자열
     */
    renderOperator(op, currentPot) {
        const traitItems = [], synergyItems = [];

        const processSingle = (t, source, potLevel) => {
            if (!t?.type) return;

            // type 정규화: string → [{type, val}], object[] → 그대로
            const rawType = t.type;
            const typeArr = Array.isArray(rawType)
                ? rawType.map(item => typeof item === 'string' ? { type: item } : item)
                : [{ type: rawType, val: t.val }];

            const typeIncludes = (keyword) => typeArr.some(e => e.type.includes(keyword));
            // 표시 문자열: '물리 취약 +12% / 방어 불능 부여'
            const typeStr = typeArr.map(e => {
                let suffix = '';
                const st = e.skilltype || t.skilltype;
                if ((e.type === '스킬 치명타 확률' || e.type === '스킬 치명타 피해' || e.type === '스킬 배율 증가') && st) {
                    suffix = ` (${Array.isArray(st) ? st.join(', ') : st})`;
                }
                return e.val !== undefined ? `${e.type}${suffix} +${e.val}` : `${e.type}${suffix}`;
            }).join(' / ');

            // 툴팁 표시 제외 타입 필터링
            if (this.EXCLUDE_TYPES.some(ex => typeIncludes(ex)) || typeArr.some(e => e.type === '스탯')) return;
            const isPotential = potLevel !== null;
            const isActive = isPotential ? (currentPot >= potLevel) : true;
            const isUnbalanced = typeIncludes('불균형 목표에 주는 피해');
            const item = { ...t, _typeStr: typeStr, _isUnbalanced: isUnbalanced, sourceLabel: isPotential ? `${potLevel}잠재` : source, active: isActive, isPotential };
            const isSynergy = this.SYNERGY_TYPES.some(syn => typeIncludes(syn)) || t.target === '팀' || t.target === '적';
            if (isSynergy) synergyItems.push(item);
            else if (this.TRAIT_TYPES.some(tr => typeIncludes(tr))) traitItems.push(item);
        };

        const processData = (data, source, potLevel = null) => {
            if (!data) return;
            (Array.isArray(data) ? data : [data]).forEach(t => {
                if (Array.isArray(t)) t.forEach(sub => processSingle(sub, source, potLevel));
                else processSingle(t, source, potLevel);
            });
        };

        processData(op.talents, '재능');
        if (op.skill) op.skill.forEach(s => {
            const entry = Array.isArray(s) ? s[0] : s;
            processData(s, entry?.skilltype || '스킬');
        });
        if (op.potential) op.potential.forEach((p, i) => processData(p, '잠재', i + 1));

        const renderList = (list, isSynergy = false) => {
            return [...list].sort((a, b) => a.isPotential !== b.isPotential ? (a.isPotential ? 1 : -1) : 0)
                .map(t => {
                    const valStr = !t._typeStr && t.val !== undefined ? ` +${t.val}` : '';
                    const color = isSynergy ? '#FFFA00' : 'var(--accent)';
                    // 비활성(OFF 잠재/불균형 OFF): color:inherit 로 표시
                    const style = t.active === false
                        ? 'color:var(--text-secondary);font-weight:normal;'
                        : `color:${color};font-weight:bold;`;
                    return `<div style="margin-bottom:2px;${style}"><span style="color:inherit">•</span> [${t.sourceLabel}] ${t._typeStr ?? t.type}${valStr}</div>`;
                }).join('');
        };

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/operators/${op.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${op.name}</div>
                    <div class="tooltip-sub">${this.getElementName(op)} / ${this.getWepTypeName(op.usableWeapons[0])}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">기초 능력치</div>
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">공격력</span><span class="tooltip-stat-val">${op.baseAtk || 0}</span></div>
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(op.mainStat)}</span><span class="tooltip-stat-val">${op.stats?.[op.mainStat] ?? 0}</span></div>
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(op.subStat)}</span><span class="tooltip-stat-val">${op.stats?.[op.subStat] ?? 0}</span></div>
                </div>
            </div>
            ${traitItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label">오퍼레이터 특성</div><div class="tooltip-desc">${renderList(traitItems)}</div></div>` : ''}
            ${synergyItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label" style="color:#FFFA00">시너지</div><div class="tooltip-desc">${renderList(synergyItems, true)}</div></div>` : ''}
        `;
    },

    /**
     * 무기 툴팁 HTML을 렌더링한다.
     * 특성 값 범위(min~max)를 표시하고, 시너지 타입은 노란색으로 구분한다.
     *
     * @param {object} wep - 무기 데이터
     * @returns {string} HTML 문자열
     */
    renderWeapon(wep) {
        const traitItems = [], synergyItems = [];

        wep.traits.forEach((t, i) => {
            const label = t.type === '스탯' ? getStatName(t.stat) : t.type;

            let rangeStr;
            const fmt = (v) => {
                if (typeof v === 'number') return (v > 0 ? '+' : '') + v;
                if (typeof v === 'string') return (!v.startsWith('+') && !v.startsWith('-')) ? '+' + v : v;
                return v;
            };

            if (t.valByLevel?.length > 0) {
                // 레벨별 값이 있으면 최소~최대 구간 표시 (정렬 가정)
                const v1 = t.valByLevel[0];
                const v2 = t.valByLevel[t.valByLevel.length - 1];
                rangeStr = `${label} ${fmt(v1)}~${fmt(v2)}`;
            } else {
                rangeStr = `${label} ${fmt(t.val || 0)}`;
            }

            const isSynergy = (t.target === '팀' || t.target === '적' || this.SYNERGY_TYPES.some(syn => t.type.includes(syn)));
            const isUnbalanced = t.type === '불균형 목표에 주는 피해' && !state?.enemyUnbalanced;
            const bulletColor = isUnbalanced ? 'inherit' : isSynergy ? '#FFFA00' : 'var(--accent)';
            const html = `<div style="margin-bottom:2px;${isUnbalanced ? 'color:inherit;' : ''}"><span style="color:${bulletColor}">•</span> ${rangeStr}</div>`;
            if (isSynergy) synergyItems.push(html); else traitItems.push(html);
        });

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/weapons/${wep.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${wep.name}</div>
                    <div class="tooltip-sub">${this.getWepTypeName(wep.type)}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">기초 능력치</div>
                <div class="tooltip-stat-grid">
                    <div class="tooltip-stat-item"><span class="tooltip-stat-key">공격력</span><span class="tooltip-stat-val">${wep.baseAtk}</span></div>
                </div>
            </div>
            ${traitItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label">무기 특성</div><div class="tooltip-desc">${traitItems.join('')}</div></div>` : ''}
            ${synergyItems.length > 0 ? `<div class="tooltip-section"><div class="tooltip-label" style="color:#FFFA00">시너지</div><div class="tooltip-desc">${synergyItems.join('')}</div></div>` : ''}
        `;
    },

    /**
     * 장비 툴팁 HTML을 렌더링한다.
     * 단조 상태(forged=true)이면 강화된 수치를 굵게 강조한다.
     *
     * @param {object}  gear   - 장비 데이터
     * @param {boolean} forged - 단조 여부
     * @returns {string} HTML 문자열
     */
    renderGear(gear, forged = false) {
        const setName = DATA_SETS?.find(s => s.id === gear.set)?.name || '일반';
        const valStyle = forged ? 'style="color:var(--accent);font-weight:bold;"' : '';
        const stats = [];

        // 기본 스탯 1, 2 수집 (단조 시 _f 값 우선)
        if (gear.stat1) stats.push({ type: gear.stat1, val: forged && gear.val1_f !== undefined ? gear.val1_f : gear.val1 });
        if (gear.stat2) stats.push({ type: gear.stat2, val: forged && gear.val2_f !== undefined ? gear.val2_f : gear.val2 });

        const statsHtml = stats.map(s =>
            `<div class="tooltip-stat-item"><span class="tooltip-stat-key">${getStatName(s.type)}</span><span class="tooltip-stat-val" ${valStyle}>+${Math.floor(s.val)}</span></div>`
        ).join('');

        let traitHtml = '';
        if (gear.trait) {
            const traits = Array.isArray(gear.trait) ? gear.trait : [gear.trait];
            const traitLines = traits.map(t => {
                const isStatTrait = t.type === '스탯';
                const v = forged && t.val_f !== undefined ? t.val_f : t.val;

                let valStr = '';
                if (v !== undefined) {
                    if (typeof v === 'number') {
                        valStr = (v > 0 ? ' +' : ' ') + v.toFixed(1);
                    } else {
                        const sVal = String(v);
                        if (!sVal.startsWith('+') && !sVal.startsWith('-')) valStr = ' +' + sVal;
                        else valStr = ' ' + sVal;
                    }
                }

                const isUnbalanced = t.type === '불균형 목표에 주는 피해' && !state?.enemyUnbalanced;
                const accentColor = isUnbalanced ? 'inherit' : 'var(--accent)';
                const spanStyle = (!isUnbalanced && forged) ? `style="color:var(--accent);font-weight:bold;"` : '';
                const label = isStatTrait ? getStatName(t.stat) : t.type;
                return `<div style="margin-bottom:2px;${isUnbalanced ? 'color:inherit;' : ''}"><span style="color:${accentColor}">•</span> ${label}<span ${spanStyle}>${valStr}</span></div>`;
            }).join('');
            traitHtml = `<div class="tooltip-section"><div class="tooltip-label">장비 특성</div><div class="tooltip-desc">${traitLines}</div></div>`;
        }

        return `
            <div class="tooltip-header">
                <div class="tooltip-icon"><img src="images/gears/${gear.name}.webp"></div>
                <div class="tooltip-title-group">
                    <div class="tooltip-name">${gear.name}</div>
                    <div class="tooltip-sub">${this.GEAR_PART_MAP[gear.part] || gear.part} / ${setName}</div>
                </div>
            </div>
            <div class="tooltip-section">
                <div class="tooltip-label">장비 스탯</div>
                <div class="tooltip-stat-grid">${statsHtml}</div>
            </div>
            ${traitHtml}
        `;
    },

    /**
     * 스킬 툴팁 HTML을 렌더링한다.
     * @param {string} skilltype - 스킬의 종류 이름 (예: '강화 일반 공격', '궁극기')
     * @param {object} skillData - 스킬 데이터 객체
     * @param {object} opData - 해당 오퍼레이터의 기본 데이터 (속성 등 참조용)
     * @param {string} [extraHtml=''] - 타이틀 아래에 추가할 커스텀 HTML
     * @returns {string} HTML 문자열
     */
    renderSkillTooltip(skilltype, skillData, opData, extraHtml = '') {
        if (!skillData) return '';
        const entry = Array.isArray(skillData) ? skillData[0] : skillData;
        const attrLines = [];

        const element = this.getElementName(opData);
        if (element) {
            attrLines.push(`<div style="margin-bottom:2px;"><span style="color:var(--accent)">•</span> 공격 속성: ${element}</div>`);
        }

        if (skilltype === '궁극기' && entry.cost !== undefined) {
            attrLines.push(`<div style="margin-bottom:2px;"><span style="color:inherit">•</span> 궁극기 게이지: ${entry.cost}</div>`);
        }

        if (entry.type) {
            const typeArray = Array.isArray(entry.type) ? entry.type : [entry.type];
            const typeStrs = typeArray.map(t => {
                if (typeof t === 'string') return t;
                if (typeof t === 'object' && t !== null && t.type) {
                    return t.val ? `${t.type} +${t.val}` : t.type;
                }
                return '';
            }).filter(Boolean);
            if (typeStrs.length > 0) {
                attrLines.push(`<div style="margin-bottom:2px;"><span style="color:inherit">•</span> ${typeStrs.join(' / ')}</div>`);
            }
        }

        if (entry.dmg) {
            const rawDmgNum = parseInt(entry.dmg, 10);
            if (rawDmgNum > 0) {
                let dmgStr = `기본 데미지: <strong style="color:var(--accent);">${entry.dmg}</strong>`;
                if (entry.bonus) {
                    const bonusList = Array.isArray(entry.bonus) ? entry.bonus : [entry.bonus];
                    const bonusStr = bonusList.map(b => {
                        const triggerStr = Array.isArray(b.trigger) ? b.trigger.join(', ') : b.trigger;
                        let bValStr = '';
                        if (b.val !== undefined) {
                            bValStr = '+' + b.val;
                        } else if (b.perStack !== undefined) {
                            if (b.base && b.base !== '0%') bValStr = `+${b.base} + ${b.perStack}/스택`;
                            else bValStr = `+${b.perStack}/스택`;
                        } else if (b.base !== undefined) {
                            bValStr = '+' + b.base;
                        }
                        return `<span style="color:var(--text-muted);">(${triggerStr} <strong style="color:var(--accent);">${bValStr}</strong>)</span>`;
                    }).join(' ');
                    dmgStr += ` ${bonusStr}`;
                }
                attrLines.push(`<div style="margin-bottom:2px;"><span style="color:inherit">•</span> ${dmgStr}</div>`);
            }
        }

        const attrHtml = attrLines.length > 0
            ? `<div class="tooltip-section" style="margin-bottom:8px;">${attrLines.join('')}</div>`
            : '';

        return `
            <div class="tooltip-title" style="color:var(--accent); margin-bottom:6px; font-size:1.05rem; font-weight:bold;">${skilltype}</div> 
            ${extraHtml ? `<div style="margin-bottom:8px;">${extraHtml}</div>` : ''}
            ${attrHtml}
            <div class="tooltip-desc" style="color:var(--text-secondary); line-height:1.4;">${entry.desc || '설명 없음'}</div>
        `;
    }
};


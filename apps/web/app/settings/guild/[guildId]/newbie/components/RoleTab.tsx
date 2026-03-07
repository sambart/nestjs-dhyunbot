'use client';

import type { DiscordRole } from '../../../../../lib/discord-api';
import type { NewbieConfig } from '../../../../../lib/newbie-api';

interface RoleTabProps {
  config: NewbieConfig;
  roles: DiscordRole[];
  onChange: (partial: Partial<NewbieConfig>) => void;
}

export default function RoleTab({ config, roles, onChange }: RoleTabProps) {
  const isEnabled = config.roleEnabled;

  return (
    <div className="space-y-6">
      {/* 기능 활성화 토글 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">신입기간 역할 자동관리</p>
          <p className="text-xs text-gray-500 mt-0.5">
            신규 멤버에게 신입기간 역할을 자동으로 부여하고 만료 시 제거합니다.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isEnabled}
          onClick={() => onChange({ roleEnabled: !isEnabled })}
          className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
            isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
              isEnabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* 신입기간 (일수) */}
      <div>
        <label
          htmlFor="role-duration-days"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          신입기간 (일)
        </label>
        <input
          id="role-duration-days"
          type="number"
          min={1}
          max={365}
          value={config.roleDurationDays ?? ''}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            onChange({ roleDurationDays: isNaN(val) ? null : val });
          }}
          disabled={!isEnabled}
          placeholder="예: 30"
          className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        />
        <p className="text-xs text-gray-400 mt-1">
          역할이 자동으로 제거될 때까지의 기간(일수)
        </p>
      </div>

      {/* 역할 선택 */}
      <div>
        <label
          htmlFor="newbie-role"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          신입 역할
        </label>
        <select
          id="newbie-role"
          value={config.newbieRoleId ?? ''}
          onChange={(e) =>
            onChange({ newbieRoleId: e.target.value || null })
          }
          disabled={!isEnabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
        >
          <option value="">역할을 선택하세요</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>
              {role.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          신규 멤버에게 자동으로 부여할 Discord 역할
        </p>
        {roles.length === 0 && (
          <p className="text-xs text-amber-500 mt-1">
            역할 목록을 불러올 수 없습니다. 백엔드 연동 후 사용 가능합니다.
          </p>
        )}
      </div>
    </div>
  );
}
